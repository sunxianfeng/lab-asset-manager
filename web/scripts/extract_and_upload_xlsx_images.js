#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// Extract embedded images from .xlsx, map them to sheet rows, and optionally upload to PocketBase.
// Usage:
//   node extract_and_upload_xlsx_images.js <input.xlsx> [--outdir out_images] [--upload --pbUrl http://127.0.0.1:8090 --email admin@example.com --pass secret --collection assets --importRef <id>]
// Dependencies: npm install unzipper fast-xml-parser mkdirp xlsx pocketbase node-fetch form-data

const fs = require('fs');
const path = require('path');
const unzipper = require('unzipper');
const { XMLParser } = require('fast-xml-parser');
const mkdirp = require('mkdirp');
const XLSX = require('xlsx');

async function readZipEntries(filePath) {
  const map = new Map();
  const directory = await unzipper.Open.file(filePath);
  for (const entry of directory.files) {
    const p = entry.path.replace(/\\\\/g, '/');
    const buf = await entry.buffer();
    map.set(p, buf);
  }
  return map;
}

function parseWorkbook(map, parser) {
  const wbXml = map.get('xl/workbook.xml')?.toString();
  if (!wbXml) throw new Error('xl/workbook.xml not found');
  const wb = parser.parse(wbXml);
  const sheets = (wb.workbook.sheets && wb.workbook.sheets.sheet) || [];
  // sheets may be object or array
  return Array.isArray(sheets) ? sheets : [sheets];
}

function parseRels(relBuf, parser) {
  if (!relBuf) return [];
  const relXml = relBuf.toString();
  const rel = parser.parse(relXml);
  const relationships = (rel.Relationships && rel.Relationships.Relationship) || [];
  return Array.isArray(relationships) ? relationships : [relationships];
}

function normalizeHeaderKey(h) {
  if (h === undefined || h === null) return '';
  const s = String(h);
  try {
    const cleaned = s.normalize ? s.normalize('NFKC') : s;
    return cleaned.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLowerCase();
  } catch (e) {
    return s.replace(/[^A-Za-z0-9]+/g, ' ').trim().toLowerCase();
  }
}

async function extractAndMap(inputFile, outDir, options) {
  await mkdirp(outDir);
  const map = await readZipEntries(inputFile);
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });

  // workbook -> sheets
  const sheets = parseWorkbook(map, parser);

  // workbook rels map rId -> target
  const wbRels = parseRels(map.get('xl/_rels/workbook.xml.rels'), parser);
  const wbRelMap = Object.fromEntries(wbRels.map(r => [r.Id, r.Target]));

  const results = [];

  for (const s of sheets) {
    const name = s.name || s['@_name'] || s['name'];
    const rid = s['r:id'] || s['@_r:id'] || s['rId'] || s['id'];
    const target = wbRelMap[rid];
    if (!target) continue;
    const sheetPath = path.posix.join('xl', target.replace(/^\/+/, ''));
    const sheetRelsPath = path.posix.join('xl', path.posix.dirname(target), '_rels', path.posix.basename(target) + '.rels');

    const sheetBuf = map.get(sheetPath);
    if (!sheetBuf) continue;
    const sheet = parser.parse(sheetBuf.toString());

    // find drawing r:id in sheet
    const drawing = (sheet.worksheet && sheet.worksheet.drawing) || (sheet.sheet && sheet.sheet.drawing);
    let drawingRid = null;
    if (drawing) {
      if (Array.isArray(drawing)) drawingRid = drawing[0]['r:id'] || drawing[0]['@_r:id'];
      else drawingRid = drawing['r:id'] || drawing['@_r:id'];
    }

    if (!drawingRid) continue;

    // parse sheet rels to map drawing rid -> drawing target
    const sheetRels = parseRels(map.get(sheetRelsPath), parser);
    const sheetRelMap = Object.fromEntries(sheetRels.map(r => [r.Id, r.Target]));
    const drawingTarget = sheetRelMap[drawingRid];
    if (!drawingTarget) continue;

    const drawingPath = path.posix.join('xl', path.posix.dirname(target), '..', drawingTarget).replace(/\\/g, '/');
    // normalize: drawingTarget is often like ../drawings/drawing1.xml
    const drawingPathNormalized = path.posix.normalize(drawingPath);
    const drawingBuf = map.get(drawingPathNormalized);
    if (!drawingBuf) continue;

    const drawingXml = parser.parse(drawingBuf.toString());
    // drawing xml has xdr:twoCellAnchor or xdr:oneCellAnchor
    const anchors = [];
    const root = drawingXml['xdr:wsDr'] || drawingXml.worksheetDrawing || drawingXml;
    if (!root) continue;
    const twoAnchors = root['xdr:twoCellAnchor'] || root['twoCellAnchor'];
    const oneAnchors = root['xdr:oneCellAnchor'] || root['oneCellAnchor'];

    const collectAnchors = (a) => {
      if (!a) return [];
      return Array.isArray(a) ? a : [a];
    };

    const two = collectAnchors(twoAnchors);
    const one = collectAnchors(oneAnchors);

    anchors.push(...two, ...one);

    // parse drawing rels to map embed rId -> media target
    const drawingRelsPath = drawingPathNormalized.replace('xl/', 'xl/').replace(/\.xml$/, '.xml.rels');
    const drawingRels = parseRels(map.get(drawingRelsPath), parser);
    const drawingRelMap = Object.fromEntries(drawingRels.map(r => [r.Id, r.Target]));

    // iterate anchors
    for (const anc of anchors) {
      // get from row/col
      const from = anc['xdr:from'] || anc['from'];
      const pic = anc['xdr:pic'] || anc['pic'];
      if (!from || !pic) continue;
      const row = Number(from['xdr:row'] ?? from['row']);
      const col = Number(from['xdr:col'] ?? from['col']);
      const blip = (pic['xdr:blipFill'] && (pic['xdr:blipFill']['a:blip'] || pic['xdr:blipFill']['blip'])) || (pic['blipFill'] && (pic['blipFill']['a:blip'] || pic['blipFill']['blip']));
      if (!blip) continue;
      const embed = blip['r:embed'] || blip['@_r:embed'] || blip['embed'];
      if (!embed) continue;
      const mediaTarget = drawingRelMap[embed];
      if (!mediaTarget) continue;
      // mediaTarget like ../media/image1.png => normalize
      const mediaPath = path.posix.normalize(path.posix.join(path.posix.dirname(drawingPathNormalized), '..', mediaTarget));
      const mediaPathClean = mediaPath.replace(/^\/+/, '').replace(/\\/g, '/');
      const mediaRel = mediaPathClean.startsWith('xl/') ? mediaPathClean : path.posix.join('xl', mediaPathClean);
      const mediaBuf = map.get(mediaRel);
      if (!mediaBuf) continue;

      // write media file
      const mediaName = `${name.replace(/[^a-z0-9]/gi, '_')}_r${row}_c${col}_${path.posix.basename(mediaRel)}`;
      const outFile = path.join(outDir, mediaName);
      fs.writeFileSync(outFile, mediaBuf);

      results.push({ sheet: name, row, col, mediaRel, outFile });
    }
  }

  return results;
}

async function uploadToPocketBase(files, inputFile, options) {
  const PocketBase = require('pocketbase/cjs');
  const pb = new PocketBase(options.pbUrl);
  await pb.admins.authWithPassword(options.email, options.pass);

  const importedIds = [];
  for (const f of files) {
    // Optionally, attempt to read associated row values via XLSX
    const wb = XLSX.readFile(inputFile, { cellDates: true });
    const sheet = wb.Sheets[f.sheet];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
    const headerRow = rows[0] || [];
    const dataRow = rows[f.row] || [];

    // Build form data fields from headerRow
    const fd = new FormData();
    if (options.importRef) fd.append('import_ref', options.importRef);
    // Map header->value
    for (let i = 0; i < headerRow.length; i++) {
      const h = headerRow[i];
      if (!h) continue;
      const key = normalizeHeaderKey(h);
      const v = dataRow[i];
      if (v === undefined || v === null || v === '') continue;
      fd.append(key, String(v));
    }
    // append image
    const fileStream = fs.createReadStream(f.outFile);
    fd.append('image', fileStream, path.basename(f.outFile));

    // Use PocketBase JS client to create record
    try {
      const res = await pb.collection(options.collection || 'assets').create(fd);
      console.log('Uploaded and created record:', res.id, 'for', f.outFile);
      importedIds.push(res.id);
    } catch (e) {
      console.error('Failed to upload', f.outFile, e.message || e);
    }
  }
  return importedIds;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length < 1) {
    console.error('Usage: node extract_and_upload_xlsx_images.js <input.xlsx> [--outdir out_images] [--upload --pbUrl http://127.0.0.1:8090 --email admin@example.com --pass secret --collection assets --importRef <id>]');
    process.exit(2);
  }
  const input = argv[0];
  const outDirArgIndex = argv.indexOf('--outdir');
  const outDir = outDirArgIndex >= 0 ? argv[outDirArgIndex + 1] : path.join(process.cwd(), 'extracted_images');
  const upload = argv.includes('--upload');
  const pbUrlIndex = argv.indexOf('--pbUrl');
  const pbUrl = pbUrlIndex >= 0 ? argv[pbUrlIndex + 1] : process.env.PB_URL || 'http://127.0.0.1:8090';
  const emailIndex = argv.indexOf('--email');
  const email = emailIndex >= 0 ? argv[emailIndex + 1] : process.env.PB_ADMIN_EMAIL;
  const passIndex = argv.indexOf('--pass');
  const pass = passIndex >= 0 ? argv[passIndex + 1] : process.env.PB_ADMIN_PASSWORD;
  const collectionIndex = argv.indexOf('--collection');
  const collection = collectionIndex >= 0 ? argv[collectionIndex + 1] : 'assets';
  const importRefIndex = argv.indexOf('--importRef');
  const importRef = importRefIndex >= 0 ? argv[importRefIndex + 1] : undefined;

  try {
    console.log('Extracting images from', input, 'to', outDir);
    const files = await extractAndMap(input, outDir, {});
    if (!files.length) console.log('No images extracted.');
    else console.log('Extracted files:', files.map(f => `${f.outFile} (sheet=${f.sheet}, row=${f.row}, col=${f.col})`));

    if (upload) {
      if (!email || !pass) {
        console.error('Missing PocketBase admin credentials. Provide --email and --pass or set PB_ADMIN_EMAIL/PB_ADMIN_PASSWORD.');
        process.exit(3);
      }
      console.log('Uploading to PocketBase at', pbUrl, 'collection', collection);
      const ids = await uploadToPocketBase(files, input, { pbUrl, email, pass, collection, importRef });
      console.log('Uploaded record ids:', ids);
    }
  } catch (e) {
    console.error('Error:', e.message || e);
    process.exit(1);
  }
}

if (require.main === module) main();
