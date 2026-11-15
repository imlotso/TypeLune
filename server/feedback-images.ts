import sharp from 'sharp';

const maxBytes = 5 * 1024 * 1024;
const maxPixels = 40_000_000;
// Leave room for platform response overhead when an attachment is retrieved.
const maxProcessedBytes = 3.5 * 1024 * 1024;
export type FeedbackImage = { name: string; bytes: Buffer };

export async function prepareFeedbackImages(values: unknown[]): Promise<FeedbackImage[]> {
  if (values.length > 3) throw new Error('每条反馈最多 3 张截图');
  const images: FeedbackImage[] = [];
  for (const value of values) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('截图格式无效');
    const { name, data } = value as Record<string, unknown>;
    if (typeof name !== 'string' || !name.trim() || name.length > 255 || /[\p{Cc}\p{Cf}]/u.test(name) || typeof data !== 'string') throw new Error('截图格式无效');
    const match = /^data:image\/(png|jpeg|webp);base64,/.exec(data);
    const encoded = match ? data.slice(match[0].length) : '';
    if (!match || !encoded || encoded.length > Math.ceil(maxBytes / 3) * 4 || encoded.length % 4 !== 0 || /[^A-Za-z0-9+/=]/u.test(encoded)) throw new Error('截图须为不超过 5 MiB 的 JPG、PNG 或 WebP');
    const bytes = Buffer.from(encoded, 'base64');
    if (!bytes.length || bytes.length > maxBytes || bytes.toString('base64') !== encoded) throw new Error('截图须为不超过 5 MiB 的 JPG、PNG 或 WebP');
    try {
      const source = sharp(bytes, { animated: true, limitInputPixels: maxPixels, failOn: 'error' });
      const info = await source.metadata();
      if (info.format !== match[1] || !info.width || !info.height || (info.pages ?? 1) !== 1 || info.width * info.height > maxPixels) throw new Error();
      let processed: Buffer | undefined;
      for (const width of [2560, 2048, 1600]) {
        for (const quality of [82, 68, 54]) {
          const candidate = await source.clone().rotate().resize({ width, height: width, fit: 'inside', withoutEnlargement: true }).webp({ quality }).toBuffer();
          if (candidate.length <= maxProcessedBytes) { processed = candidate; break; }
        }
        if (processed) break;
      }
      if (!processed) throw new Error();
      images.push({ name: name.trim(), bytes: processed });
    } catch { throw new Error('截图内容无效或无法处理'); }
  }
  return images;
}
