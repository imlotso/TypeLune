/** Leave headroom below the sitemap protocol's 50,000 URL / 50 MB limits. */
export function sitemapChunks(entries: Iterable<string>, maxUrls = 45_000, maxBytes = 45 * 1024 * 1024): string[][] {
  const chunks: string[][] = [[]];
  let bytes = 0;
  for (const entry of entries) {
    const size = Buffer.byteLength(entry, 'utf8');
    if (size > maxBytes) throw new RangeError('A sitemap entry exceeds the supported byte limit');
    let current = chunks[chunks.length - 1];
    if (current.length && (current.length >= maxUrls || bytes + size > maxBytes)) {
      current = []; chunks.push(current); bytes = 0;
    }
    current.push(entry); bytes += size;
  }
  return chunks;
}
