import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { articles } from '../src/data/articles';
import { AsyncSqlite } from '../server/database/sqlite';
import { repairCatalogPunctuation, punctuationRepairs } from '../server/catalog-punctuation-repair';

it('repairs only exact shipped text, increments revision once, and leaves edited/deleted articles intact', async () => {
  const raw = new Database(':memory:');
  raw.exec('CREATE TABLE public_articles (id TEXT PRIMARY KEY,text TEXT,revision INTEGER,status TEXT,content_hash TEXT,updated_at INTEGER)');
  const db = new AsyncSqlite(raw);
  const first = articles.find(a=>a.id===punctuationRepairs[0].id)!;
  const second = articles.find(a=>a.id===punctuationRepairs[1].id)!;
  const oldFirst = first.content.replaceAll('\u2014\u2014','\u2500\u2500');
  expect(createHash('sha256').update(oldFirst).digest('hex')).toBe(punctuationRepairs[0].originalSha256);
  raw.prepare('INSERT INTO public_articles VALUES (?,?,3,?,?,0)').run(first.id,oldFirst,'published','old');
  raw.prepare('INSERT INTO public_articles VALUES (?,?,3,?,?,0)').run(second.id,second.content+'edited','published','edited');
  try {
    expect(await repairCatalogPunctuation(db,()=>123)).toEqual([{id:first.id,status:'updated'},{id:second.id,status:'skipped'}]);
    expect(raw.prepare('SELECT text,revision,updated_at FROM public_articles WHERE id=?').get(first.id)).toEqual({text:first.content,revision:4,updated_at:123});
    expect(await repairCatalogPunctuation(db)).toEqual([{id:first.id,status:'already-correct'},{id:second.id,status:'skipped'}]);
    raw.prepare('UPDATE public_articles SET text=?,status=? WHERE id=?').run(oldFirst,'deleted',first.id);
    expect((await repairCatalogPunctuation(db))[0].status).toBe('skipped');
  } finally { await db.close(); }
});

it('rolls back the whole repair when a later write fails', async () => {
  const raw = new Database(':memory:');
  raw.exec('CREATE TABLE public_articles (id TEXT PRIMARY KEY,text TEXT,revision INTEGER,status TEXT,content_hash TEXT,updated_at INTEGER)');
  const db = new AsyncSqlite(raw);
  for (const repair of punctuationRepairs) {
    const corrected=articles.find(a=>a.id===repair.id)!.content;
    const text=repair.id === 'zh-intermediate-6' ? corrected.replaceAll('\u2014\u2014','\u2500\u2500') : [1438,1454,2257].reduce((text,index)=>text.slice(0,index)+'\u2500\u2500'+text.slice(index+2),corrected);
    expect(createHash('sha256').update(text).digest('hex')).toBe(repair.originalSha256);
    raw.prepare('INSERT INTO public_articles VALUES (?,?,1,?,?,0)').run(repair.id,text,'published','old');
  }
  raw.exec(`CREATE TRIGGER fail_second BEFORE UPDATE ON public_articles WHEN OLD.id='zh-advanced-5' BEGIN SELECT RAISE(ABORT, 'test failure'); END`);
  try {
    await expect(repairCatalogPunctuation(db)).rejects.toThrow('test failure');
    expect(raw.prepare('SELECT revision FROM public_articles').all()).toEqual([{revision:1},{revision:1}]);
    raw.exec('DROP TRIGGER fail_second');
    expect((await repairCatalogPunctuation(db)).map(r=>r.status)).toEqual(['updated','updated']);
  } finally { await db.close(); }
});

it('does not overwrite a revision that changes after the initial read', async () => {
  const raw=new Database(':memory:');
  raw.exec('CREATE TABLE public_articles (id TEXT PRIMARY KEY,text TEXT,revision INTEGER,status TEXT,content_hash TEXT,updated_at INTEGER)');
  const db=new AsyncSqlite(raw);
  const repair=punctuationRepairs[0];
  const old=articles.find(a=>a.id===repair.id)!.content.replaceAll('\u2014\u2014','\u2500\u2500');
  raw.prepare('INSERT INTO public_articles VALUES (?,?,1,?,?,0)').run(repair.id,old,'published','old');
  const prepare=db.prepare.bind(db);
  db.prepare=(sql)=>{
    const statement=prepare(sql);
    if(sql.startsWith('UPDATE public_articles SET text=')) {
      const run=statement.run.bind(statement);
      statement.run=async (...values)=>{
        raw.prepare('UPDATE public_articles SET revision=2,text=? WHERE id=?').run('concurrent edit',repair.id);
        return run(...values);
      };
    }
    return statement;
  };
  try {
    expect((await repairCatalogPunctuation(db))[0].status).toBe('skipped');
    expect(raw.prepare('SELECT text,revision FROM public_articles WHERE id=?').get(repair.id)).toEqual({text:'concurrent edit',revision:2});
  } finally { await db.close(); }
});
