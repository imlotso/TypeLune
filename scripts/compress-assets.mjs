import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { gzip, brotliCompress, constants } from 'node:zlib';

const gzipAsync = promisify(gzip);
const brotliAsync = promisify(brotliCompress);
let count = 0;
async function compressDirectory(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) { await compressDirectory(path); continue; }
    if (!/\.(?:js|css|svg|json)$/u.test(entry.name)) continue;
    const input = await readFile(path);
    if (input.length < 1024) continue;
    const variants = await Promise.all([
      gzipAsync(input, { level: 9 }),
      brotliAsync(input, { params: { [constants.BROTLI_PARAM_QUALITY]: 9 } }),
    ]);
    for (const [index, suffix] of ['gz', 'br'].entries()) {
      if (variants[index].length < input.length * 0.9) { await writeFile(`${path}.${suffix}`, variants[index]); count++; }
    }
  }
}
await compressDirectory('dist/client/assets');
console.log(`Prepared ${count} precompressed static asset variants.`);
