import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex } from '@noble/hashes/utils';
import { api } from './api';
import type { BackgroundImage } from './background';

const chunkBytes=768*1024;
export async function uploadBackground(file:File,ownerId:string,uploadId:string,signal?:AbortSignal):Promise<BackgroundImage>{
  const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>typeof reader.result==='string'?resolve(reader.result):reject(new Error('图片无法读取'));reader.onerror=()=>reject(new Error('图片无法读取'));reader.readAsDataURL(file);});
  signal?.throwIfAborted();const mime=/^data:(image\/(?:png|jpeg|webp));base64,/.exec(data)?.[1];if(!mime||file.size>10*1024*1024)throw new Error('请选择不超过 10 MB 的 JPG、PNG 或 WebP');
  const encoded=data.slice(data.indexOf(',')+1);const binary=atob(encoded);const bytes=Uint8Array.from(binary,character=>character.charCodeAt(0));
  const digest=bytesToHex(sha256(bytes));const chunkCount=Math.ceil(bytes.length/chunkBytes);const headers={'X-Workspace-Owner':ownerId};
  for(let chunkIndex=0;chunkIndex<chunkCount;chunkIndex++){
    await api('/api/backgrounds/uploads/chunks',{method:'POST',headers,signal,timeoutMs:60_000,body:{uploadId,name:file.name.replace(/[\p{Cc}\p{Cf}]/gu,'').slice(0,120)||'背景图片',mime,totalBytes:bytes.length,digest,chunkCount,chunkIndex,data:encoded.slice(chunkIndex*chunkBytes/3*4,(chunkIndex+1)*chunkBytes/3*4)}});
  }
  return(await api<{image:BackgroundImage}>('/api/backgrounds/uploads/complete',{method:'POST',headers,signal,timeoutMs:60_000,body:{uploadId}})).image;
}
export async function discardBackgroundUpload(ownerId:string,uploadId:string){
  await api('/api/backgrounds/uploads/discard',{method:'POST',headers:{'X-Workspace-Owner':ownerId},body:{uploadId},timeoutMs:30_000});
}
