import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import sharp from 'sharp';
import { z } from 'zod';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AsyncDatabase } from './database/types.js';
import type { AccountUser } from './account.js';
import type { WorkspaceItem } from '../src/lib/models.js';
import { backgroundFileId, type BackgroundImage } from '../src/lib/background.js';
import { profileValue } from './profile.js';

export const backgroundChunkBytes = 768 * 1024;
const maxInput = 10 * 1024 * 1024, maxOutput = 20 * 1024 * 1024, expiry = 24 * 60 * 60_000;
const uploadId=z.uuid().refine(id=>!!backgroundFileId('/api/backgrounds/files/'+id));
const metadata = { uploadId, name: z.string().min(1).max(120).regex(/^[^\p{Cc}\p{Cf}]+$/u), mime: z.enum(['image/png','image/jpeg','image/webp']), totalBytes: z.number().int().min(1).max(maxInput), digest: z.string().regex(/^[a-f0-9]{64}$/), chunkCount: z.number().int().min(1).max(Math.ceil(maxInput/backgroundChunkBytes)) };
const chunkSchema = z.strictObject({ ...metadata, chunkIndex: z.number().int().nonnegative(), data: z.string().min(1).max(backgroundChunkBytes/3*4) }).refine(value=>value.chunkCount===Math.ceil(value.totalBytes/backgroundChunkBytes)&&value.chunkIndex<value.chunkCount);
const completeSchema = z.strictObject({uploadId});
type Chunk = z.infer<typeof chunkSchema>;
type ChunkRow = { chunk_index:number; chunk_count:number; total_bytes:number; name:string; mime:string; digest:string; bytes:Buffer };
type FileRow = { id:string; user_id:string; name:string; width:number; height:number; digest:string; bytes:Buffer };
class BackgroundFileError extends Error { constructor(message:string,public status=400){super(message);} }
const reference = (row: Pick<FileRow,'id'|'name'|'width'|'height'>): BackgroundImage => ({ image:'/api/backgrounds/files/'+row.id,name:row.name,width:row.width,height:row.height });

export async function normalizeBackgroundLosslessly(bytes:Buffer,mime:string){
  const image=sharp(bytes,{limitInputPixels:40_000_000,failOn:'warning'});const info=await image.metadata();
  if(!['png','jpeg','webp'].includes(info.format??'')||'image/'+info.format!==mime||(info.pages??1)!==1)throw new BackgroundFileError('图片须为单帧 JPG、PNG 或 WebP');
  const result=await image.rotate().webp({lossless:true,exact:true,effort:5}).toBuffer({resolveWithObject:true});
  if(result.data.length>maxOutput)throw new BackgroundFileError('无损处理后的图片超过 20 MB，请选择较小的图片',413);
  return result;
}

export async function createBackgroundFiles(db:AsyncDatabase,now:()=>number=Date.now){
  const available=async()=>db.dialect==='sqlite'||!!(await db.prepare("SELECT to_regclass('background_files') AS name").get())?.name;
  const fileInfo=async(owner:string,id:string)=>await db.prepare('SELECT id,user_id,name,width,height,digest FROM background_files WHERE user_id=? AND id=?').get(owner,id) as Omit<FileRow,'bytes'>|undefined;
  const rawChunks=async(owner:string,id:string)=>await db.prepare('SELECT chunk_index,chunk_count,total_bytes,name,mime,digest,bytes FROM background_upload_chunks WHERE user_id=? AND upload_id=? ORDER BY chunk_index').all(owner,id) as ChunkRow[];
  const references=async(owner:string)=>{
    const rows=await db.prepare("SELECT value FROM workspace_items WHERE user_id=? AND kind='background' AND value IS NOT NULL").all(owner);const ids=new Set<string>();
    for(const row of rows){try{const id=backgroundFileId(JSON.parse(row.value).image);if(id)ids.add(id);}catch{/* Invalid legacy items never authorize a file. */}}
    return ids;
  };
  const discard=async(owner:string,id:string)=>{
    await db.prepare('DELETE FROM background_upload_chunks WHERE user_id=? AND upload_id=?').run(owner,id);
    if(!(await references(owner)).has(id))await db.prepare('DELETE FROM background_files WHERE user_id=? AND id=?').run(owner,id);
  };
  const put=db.transaction(async(owner:string,input:Chunk,bytes:Buffer,authorize:()=>Promise<boolean>)=>{
    if(!await authorize())throw new BackgroundFileError('登录账号已变更',403);
    const done=await fileInfo(owner,input.uploadId);if(done){if(done.digest!==input.digest)throw new BackgroundFileError('上传内容已变化，请重新选择图片',409);return;}
    await db.prepare('DELETE FROM background_upload_chunks WHERE user_id=? AND created_at<?').run(owner,now()-expiry);
    const active=await references(owner);const expired=await db.prepare('SELECT id FROM background_files WHERE user_id=? AND created_at<?').all(owner,now()-expiry);
    for(const row of expired)if(!active.has(row.id))await db.prepare('DELETE FROM background_files WHERE user_id=? AND id=?').run(owner,row.id);
    const rows=await rawChunks(owner,input.uploadId);
    if(rows.some(row=>row.chunk_count!==input.chunkCount||row.total_bytes!==input.totalBytes||row.name!==input.name||row.mime!==input.mime||row.digest!==input.digest))throw new BackgroundFileError('上传内容已变化，请重新选择图片',409);
    const existing=rows.find(row=>row.chunk_index===input.chunkIndex);if(existing){if(!Buffer.from(existing.bytes).equals(bytes))throw new BackgroundFileError('上传内容已变化，请重新选择图片',409);return;}
    const size=db.dialect==='postgres'?'octet_length(bytes)':'length(bytes)';
    const usage=await db.prepare(`SELECT COALESCE(SUM(${size}),0) AS bytes,COUNT(DISTINCT upload_id) AS uploads FROM background_upload_chunks WHERE user_id=?`).get(owner);
    if(Number(usage.bytes)+bytes.length>24*1024*1024||(!rows.length&&Number(usage.uploads)>=3))throw new BackgroundFileError('待上传图片过多，请稍后重试',413);
    await db.prepare('INSERT INTO background_upload_chunks(user_id,upload_id,chunk_index,chunk_count,total_bytes,name,mime,digest,bytes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(owner,input.uploadId,input.chunkIndex,input.chunkCount,input.totalBytes,input.name,input.mime,input.digest,bytes,now());
  });
  const complete=async(owner:string,id:string,authorize:()=>Promise<boolean>)=>{
    const done=await fileInfo(owner,id);if(done){if(!await authorize())throw new BackgroundFileError('登录账号已变更',403);return reference(done);}
    const rows=await rawChunks(owner,id);const first=rows[0];
    if(!first||rows.length!==first.chunk_count||rows.some((row,index)=>row.chunk_index!==index))throw new BackgroundFileError('图片上传尚未完成，请重试');
    const bytes=Buffer.concat(rows.map(row=>Buffer.from(row.bytes)));
    if(bytes.length!==first.total_bytes||bytes.length>maxInput||createHash('sha256').update(bytes).digest('hex')!==first.digest){await discard(owner,id);throw new BackgroundFileError('图片上传校验失败，请重新上传');}
    let result:Awaited<ReturnType<typeof normalizeBackgroundLosslessly>>;
    try{result=await normalizeBackgroundLosslessly(bytes,first.mime);}catch(error){await discard(owner,id);if(error instanceof BackgroundFileError)throw error;throw new BackgroundFileError('图片无法读取或尺寸超过 4000 万像素');}
    return db.transaction(async()=>{
      if(!await authorize())throw new BackgroundFileError('登录账号已变更',403);
      const existing=await fileInfo(owner,id);if(existing)return reference(existing);
      const size=db.dialect==='postgres'?'octet_length(bytes)':'length(bytes)';const usage=await db.prepare(`SELECT COALESCE(SUM(${size}),0) AS bytes,COUNT(*) AS files FROM background_files WHERE user_id=?`).get(owner);
      if(Number(usage.bytes)+result.data.length>80*1024*1024||Number(usage.files)>=6)throw new BackgroundFileError('图片存储已满，请取消其他待保存图片',413);
      await db.prepare('INSERT INTO background_files(id,user_id,name,mime,width,height,digest,bytes,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run(id,owner,first.name,'image/webp',result.info.width,result.info.height,first.digest,result.data,now());
      await db.prepare('DELETE FROM background_upload_chunks WHERE user_id=? AND upload_id=?').run(owner,id);
      return reference({id,name:first.name,width:result.info.width,height:result.info.height});
    }).immediate();
  };
  const validateReferences=async(owner:string,items:WorkspaceItem[])=>{
    for(const item of items){if(item.kind!=='background'||item.deleted)continue;const id=backgroundFileId((item.value as {image?:unknown})?.image);if(id&&!await fileInfo(owner,id))throw new BackgroundFileError('背景图片已删除，请重新选择图片',409);}
  };
  const deleteReplaced=async(owner:string,previous:Set<string>)=>{
    const current=await references(owner);for(const id of previous)if(!current.has(id))await db.prepare('DELETE FROM background_files WHERE user_id=? AND id=?').run(owner,id);
  };
  return {available,put:put.immediate,complete,discard,references,validateReferences,deleteReplaced,fileInfo};
}

type Options={db:AsyncDatabase;store:Awaited<ReturnType<typeof createBackgroundFiles>>;userFor:(request:FastifyRequest)=>Promise<AccountUser|undefined>;accountMatches:(request:FastifyRequest,user:AccountUser)=>boolean};
export function registerBackgroundFiles(app:FastifyInstance,{db,store,userFor,accountMatches}:Options){
  const owner=async(request:FastifyRequest)=>{const user=await userFor(request);if(!user)throw new BackgroundFileError('请先登录',401);if(!accountMatches(request,user))throw new BackgroundFileError('登录账号已变更',403);if(!await store.available())throw new BackgroundFileError('背景图片存储尚未安装',503);return user;};
  const guarded=(handler:(request:FastifyRequest,reply:any)=>Promise<unknown>)=>async(request:FastifyRequest,reply:any)=>{try{return await handler(request,reply);}catch(error){if(error instanceof BackgroundFileError)return reply.code(error.status).send({error:error.message});throw error;}};
  app.post('/api/backgrounds/uploads/chunks',{bodyLimit:1_100_000,config:{rateLimit:{max:90,timeWindow:'1 minute'}}},guarded(async(request)=>{
    const user=await owner(request);const parsed=chunkSchema.safeParse(request.body);if(!parsed.success)throw new BackgroundFileError('图片上传数据无效');
    const data=parsed.data;const bytes=Buffer.from(data.data,'base64');const expected=data.chunkIndex===data.chunkCount-1?data.totalBytes-data.chunkIndex*backgroundChunkBytes:backgroundChunkBytes;
    if(bytes.length!==expected||bytes.toString('base64')!==data.data)throw new BackgroundFileError('图片上传数据无效');
    await store.put(user.id,data,bytes,async()=>{const current=await userFor(request);return current?.id===user.id&&current.auth_version===user.auth_version;});return{ok:true};
  }));
  app.post('/api/backgrounds/uploads/complete',guarded(async(request)=>{
    const user=await owner(request);const parsed=completeSchema.safeParse(request.body);if(!parsed.success)throw new BackgroundFileError('图片上传数据无效');
    return{image:await store.complete(user.id,parsed.data.uploadId,async()=>{const current=await userFor(request);return current?.id===user.id&&current.auth_version===user.auth_version;})};
  }));
  app.post('/api/backgrounds/uploads/discard',guarded(async(request)=>{
    const user=await owner(request);const parsed=completeSchema.safeParse(request.body);if(!parsed.success)throw new BackgroundFileError('图片上传数据无效');
    await db.transaction(async()=>{const current=await userFor(request);if(current?.id!==user.id||current.auth_version!==user.auth_version)throw new BackgroundFileError('登录账号已变更',403);await store.discard(user.id,parsed.data.uploadId);}).immediate();return{ok:true};
  }));
  app.get('/api/backgrounds/state',guarded(async(request)=>{
    const user=await owner(request);const theme=(request.query as {theme?:string}).theme;if(theme!=='light'&&theme!=='dark')throw new BackgroundFileError('壁纸选项无效');
    const row=await db.prepare("SELECT value FROM workspace_items WHERE user_id=? AND kind='background' AND item_id=?").get(user.id,theme);
    const preferences=await db.prepare("SELECT value FROM workspace_items WHERE user_id=? AND kind='settings' AND item_id='preferences'").get(user.id);const settings=preferences?.value?JSON.parse(preferences.value):{};
    return{background:row?.value?JSON.parse(row.value):null,automatic:settings.wallpapers?.[theme]??'off',adaptive:settings.wallpaperAdaptive?.[theme]!==false,presentation:settings.backgroundPresentation?.[theme]??null};
  }));
  app.get('/api/backgrounds/files/:id',async(request,reply)=>{
    const {id}=request.params as {id:string};if(!z.uuid().safeParse(id).success||!await store.available())return reply.code(404).send({error:'图片不可查看'});
    const bytes=await db.transaction(async()=>{
      const row=await db.prepare('SELECT f.user_id,u.avatar FROM background_files f JOIN users u ON u.id=f.user_id WHERE f.id=? AND u.disabled_at IS NULL').get(id);if(!row)return null;
      const viewer=await userFor(request);if(viewer?.id!==row.user_id&&(!profileValue(row.avatar).profilePublic||!(await store.references(row.user_id)).has(id)))return null;
      const file=await db.prepare('SELECT bytes FROM background_files WHERE id=?').get(id);return file?Buffer.from(file.bytes):null;
    }).immediate();
    if(!bytes)return reply.code(404).send({error:'图片不可查看'});
    reply.header('Cache-Control','private, no-store').header('Content-Type','image/webp').header('Content-Security-Policy',"default-src 'none'; sandbox");
    return reply.send(Readable.from((function*(){for(let offset=0;offset<bytes.length;offset+=64*1024)yield bytes.subarray(offset,offset+64*1024);})()));
  });
}

export { BackgroundFileError };
