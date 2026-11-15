import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex } from '@noble/hashes/utils';
import { api } from './api';

const chunkBytes = 768 * 1024;
const chunkBase64Length = chunkBytes / 3 * 4;
const maxFileBytes = 5 * 1024 * 1024;
const readFile = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('无法读取截图'));
  reader.onerror = () => reject(new Error('无法读取截图'));
  reader.readAsDataURL(file);
});

export async function stageFeedbackAttachments(files: File[], ownerId: string, requestId: string) {
  const references: Array<{ staged: true; fileIndex: number; name: string; mime: string; totalBytes: number; digest: string; chunkCount: number }> = [];
  for (const [fileIndex, file] of files.entries()) {
    const dataUrl = await readFile(file);
    const match = /^data:(image\/(?:png|jpeg|webp));base64,/.exec(dataUrl);
    if (!match || file.size < 1 || file.size > maxFileBytes) throw new Error('截图须为不超过 5 MiB 的 JPG、PNG 或 WebP');
    const encoded = dataUrl.slice(match[0].length);
    let binary: string;
    try { binary = atob(encoded); } catch { throw new Error('无法读取截图'); }
    if (binary.length !== file.size) throw new Error('无法读取截图');
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    const digest = bytesToHex(sha256(bytes)); const chunkCount = Math.ceil(bytes.length / chunkBytes);
    const reference = { staged: true as const, fileIndex, name: file.name, mime: match[1], totalBytes: bytes.length, digest, chunkCount };
    for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex++) {
      const data = encoded.slice(chunkIndex * chunkBase64Length, (chunkIndex + 1) * chunkBase64Length);
      const result = await api<{ ok?: boolean }>('/api/feedback/uploads', { method: 'POST', headers: { 'X-Workspace-Owner': ownerId }, timeoutMs: 60_000,
        body: { requestId, fileIndex, chunkIndex, chunkCount, name: reference.name, mime: reference.mime, totalBytes: reference.totalBytes, digest, data } });
      if (result.ok !== true) throw new Error('截图上传结果无法确认，请重试');
    }
    references.push(reference);
  }
  return references;
}
