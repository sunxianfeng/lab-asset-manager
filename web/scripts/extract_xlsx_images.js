#!/usr/bin/env node
// Usage: node extract_xlsx_images.js <input.xlsx> <outdir>
// Installs: npm install unzipper mkdirp

import fs from 'fs';
import path from 'path';
import unzipper from 'unzipper';
import mkdirp from 'mkdirp';
import { fileURLToPath } from 'url';

async function extract(input, outdir) {
  if (!fs.existsSync(input)) throw new Error('input not found: ' + input);
  await mkdirp(outdir);
  const stream = fs.createReadStream(input).pipe(unzipper.Parse({ forceStream: true }));
  const files = [];
  for await (const entry of stream) {
    const filePath = entry.path; // e.g. xl/media/image1.png
    if (filePath.startsWith('xl/media/')) {
      const name = path.basename(filePath);
      const out = path.join(outdir, name);
      await new Promise((res, rej) => {
        const ws = fs.createWriteStream(out);
        entry.pipe(ws);
        ws.on('finish', res);
        ws.on('error', rej);
      });
      files.push(out);
    } else {
      entry.autodrain();
    }
  }
  return files;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (process.argv[1] === __filename) {
  (async () => {
    try {
      const input = process.argv[2];
      const out = process.argv[3] || path.join(process.cwd(), 'extracted_images');
      if (!input) {
        console.error('Usage: node extract_xlsx_images.js <input.xlsx> <outdir>');
        process.exit(2);
      }
      const files = await extract(input, out);
      console.log('Extracted images:', files);
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  })();
}
