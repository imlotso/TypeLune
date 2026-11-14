import sharp from 'sharp';

const maxBytes = 5 * 1024 * 1024;
const maxPixels = 40_000_000;
export type FeedbackImage = { name: string; bytes: Buffer };

export async function prepareFeedbackImages(values: unknown[]): Promise<FeedbackImage[]> {
  if (values.length > 3) throw new Error('每条反馈最多 3 张截图');
  const images: FeedbackImage[] = [];
  for (const value of values) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('截图格式无效');
    const { name, data } = value as Record<string, unknown>;
    if (typeof name !== 'string' || !name.trim() || name.length > 255 || /[\p{Cc}\p{Cf}]/u.test(name) || typeof data !== 'string') throw new Error('截图格式无效');
    const match = /^data:image\/(png|jpeg|webp);base64,((?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?)$/.exec(data);
    if (!match || match[2].length > Math.ceil(maxBytes / 3) * 4) throw new Error('截图须为不超过 5 MiB 的 JPG、PNG 或 WebP');
    const bytes = Buffer.from(match[2], 'base64');
    if (!bytes.length || bytes.length > maxBytes) throw new Error('截图须为不超过 5 MiB 的 JPG、PNG 或 WebP');
    try {
      const source = sharp(bytes, { animated: true, limitInputPixels: maxPixels, failOn: 'error' });
      const info = await source.metadata();
      if (info.format !== match[1] || !info.width || !info.height || (info.pages ?? 1) !== 1 || info.width * info.height > maxPixels) throw new Error();
      const processed = await source.rotate().resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
      if (processed.length > maxBytes) throw new Error();
      images.push({ name: name.trim(), bytes: processed });
    } catch { throw new Error('截图内容无效或无法处理'); }
  }
  return images;
}
