import { randomBytes, createHash } from 'node:crypto';
import pg from 'pg';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { articles } from '../src/data/articles';
import { AsyncPostgres } from '../server/database/postgres';
import { PostgresDatabase } from '../server/postgres/database';
import { punctuationRepairs, repairCatalogPunctuation } from '../server/catalog-punctuation-repair';

const url = process.env.DAZI_DASH_TEST_PG_URL ?? process.env.DAZI_TEST_DATABASE_URL;
const original=(id:string)=>{
  const text=articles.find(a=>a.id===id)!.content;
  return id==='zh-intermediate-6' ? text.replaceAll('\u2014\u2014','\u2500\u2500') : [1438,1454,2257].reduce((s,i)=>s.slice(0,i)+'\u2500\u2500'+s.slice(i+2),text);
};
describe.skipIf(!url)('real PostgreSQL catalog punctuation repair',()=>{
  let client:pg.Client, db:AsyncPostgres, schema:string;
  beforeEach(async()=>{
    const target=new URL(url!);
    if(!['127.0.0.1','localhost'].includes(target.hostname)||!target.pathname.includes('test')) throw new Error('Loopback test database required');
    schema='dash_test_'+randomBytes(8).toString('hex');
    client=new pg.Client({connectionString:url});await client.connect();
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    await client.query('CREATE TABLE public_articles(id TEXT PRIMARY KEY,text TEXT NOT NULL,revision BIGINT NOT NULL,status TEXT NOT NULL,content_hash TEXT NOT NULL,updated_at BIGINT NOT NULL)');
    await client.query('CREATE TABLE historical_snapshots(id TEXT PRIMARY KEY,text TEXT NOT NULL)');
    for(const repair of punctuationRepairs){
      const text=original(repair.id);
      expect(createHash('sha256').update(text).digest('hex')).toBe(repair.originalSha256);
      await client.query('INSERT INTO public_articles VALUES ($1,$2,1,$3,$4,0)',[repair.id,text,'published','old']);
      await client.query('INSERT INTO historical_snapshots VALUES ($1,$2)',[repair.id,text]);
    }
    db=new AsyncPostgres(new PostgresDatabase(url!,schema));
  });
  afterEach(async()=>{
    await db?.close();
    if(client){await client.query('SET search_path TO public');if(schema)await client.query(`DROP SCHEMA "${schema}" CASCADE`);await client.end();}
  });
  it('updates both articles once and leaves historical snapshots intact',async()=>{
    expect((await repairCatalogPunctuation(db,()=>123)).map(r=>r.status)).toEqual(['updated','updated']);
    expect((await repairCatalogPunctuation(db)).map(r=>r.status)).toEqual(['already-correct','already-correct']);
    const rows=(await client.query('SELECT * FROM public_articles ORDER BY id')).rows;
    for(const row of rows){expect(row.text).toBe(articles.find(a=>a.id===row.id)!.content);expect(Number(row.revision)).toBe(2);expect(Number(row.updated_at)).toBe(123);}
    for(const row of (await client.query('SELECT * FROM historical_snapshots')).rows)expect(row.text).toBe(original(row.id));
  });
  it('skips administrator edits and deleted articles',async()=>{
    await client.query('UPDATE public_articles SET text=$1 WHERE id=$2',['admin edit',punctuationRepairs[0].id]);
    await client.query('UPDATE public_articles SET status=$1 WHERE id=$2',['deleted',punctuationRepairs[1].id]);
    expect((await repairCatalogPunctuation(db)).map(r=>r.status)).toEqual(['skipped','skipped']);
    expect((await client.query('SELECT revision FROM public_articles')).rows.map(r=>Number(r.revision))).toEqual([1,1]);
  });
  it('does not overwrite a real concurrent edit between read and update',async()=>{
    const prepare=db.prepare.bind(db);let edited=false;
    db.prepare=(sql)=>{const s=prepare(sql);if(sql.startsWith('SELECT text,revision,status')){const get=s.get;s.get=async(...values)=>{const row=await get(...values);if(!edited){edited=true;await client.query('UPDATE public_articles SET text=$1,revision=revision+1 WHERE id=$2',['concurrent admin edit',punctuationRepairs[0].id]);}return row;};}return s;};
    expect((await repairCatalogPunctuation(db)).map(r=>r.status)).toEqual(['skipped','updated']);
    expect((await client.query('SELECT text,revision FROM public_articles WHERE id=$1',[punctuationRepairs[0].id])).rows[0]).toEqual({text:'concurrent admin edit',revision:'2'});
  });
  it('rolls back the first update when the second write fails',async()=>{
    await client.query(`CREATE FUNCTION reject_second() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.id='zh-advanced-5' THEN RAISE EXCEPTION 'isolated test rejection'; END IF; RETURN NEW; END $$`);
    await client.query('CREATE TRIGGER reject_second BEFORE UPDATE ON public_articles FOR EACH ROW EXECUTE FUNCTION reject_second()');
    await expect(repairCatalogPunctuation(db)).rejects.toThrow('isolated test rejection');
    for(const row of (await client.query('SELECT * FROM public_articles')).rows){expect(row.text).toBe(original(row.id));expect(Number(row.revision)).toBe(1);}
  });
});
