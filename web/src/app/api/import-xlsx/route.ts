import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import * as unzipper from "unzipper";
import { XMLParser } from "fast-xml-parser";
import PocketBase from "pocketbase";

import { rowsToAssetUnitsWithSourceRow } from "@/lib/import/assetImport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_ALLOWED_ORIGINS = (process.env.IMPORT_API_ALLOW_ORIGINS || "*").split(",").map(s => s.trim());

function corsHeaders(origin?: string) {
  const allowOrigin = origin && CORS_ALLOWED_ORIGINS.length && CORS_ALLOWED_ORIGINS[0] !== '*'
    ? (CORS_ALLOWED_ORIGINS.includes(origin) ? origin : 'null')
    : (CORS_ALLOWED_ORIGINS[0] === '*' ? '*' : (origin ?? '*'));

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  } as Record<string, string>;
}

type ExtractedImage = {
  sheetName: string;
  /** 0-based row in sheet (OOXML anchor) */
  row0: number;
  col0: number;
  filename: string;
  bytes: Uint8Array;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === "object" && v !== null;
}

function getProp(v: unknown, key: string): unknown {
  return isRecord(v) ? v[key] : undefined;
}

function parseRelsXml(xml: string, parser: XMLParser): UnknownRecord[] {
  const rel = parser.parse(xml) as unknown;
  const relationships = getProp(getProp(rel, "Relationships"), "Relationship") ?? [];
  if (Array.isArray(relationships)) return relationships.filter(isRecord);
  return isRecord(relationships) ? [relationships] : [];
}

function findSheetList(workbookXml: string, parser: XMLParser): UnknownRecord[] {
  const wb = parser.parse(workbookXml) as unknown;
  const sheets =
    getProp(getProp(getProp(getProp(wb, "workbook"), "sheets"), "sheet"), "0") !== undefined
      ? getProp(getProp(getProp(wb, "workbook"), "sheets"), "sheet")
      : getProp(getProp(getProp(wb, "workbook"), "sheets"), "sheet");

  const raw = sheets ?? [];
  if (Array.isArray(raw)) return raw.filter(isRecord);
  return isRecord(raw) ? [raw] : [];
}

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function extToMime(filename: string) {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".bmp")) return "image/bmp";
  if (lower.endsWith(".tif") || lower.endsWith(".tiff")) return "image/tiff";
  return "application/octet-stream";
}

async function loadZipEntries(xlsxBytes: Uint8Array) {
  const directory = await unzipper.Open.buffer(Buffer.from(xlsxBytes));
  const map = new Map<string, Uint8Array>();
  for (const entry of directory.files) {
    const p = String(entry.path).replace(/\\\\/g, "/");
    const buf = (await entry.buffer()) as Buffer;
    map.set(p, new Uint8Array(buf));
  }
  return map;
}

async function extractEmbeddedImagesFromXlsx(xlsxBytes: Uint8Array, onlySheetName?: string): Promise<ExtractedImage[]> {
  const entries = await loadZipEntries(xlsxBytes);
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });

  const wbXmlBytes = entries.get("xl/workbook.xml");
  if (!wbXmlBytes) return [];
  const wbXml = Buffer.from(wbXmlBytes).toString("utf8");

  const wbRelsBytes = entries.get("xl/_rels/workbook.xml.rels");
  const wbRelsXml = wbRelsBytes ? Buffer.from(wbRelsBytes).toString("utf8") : "";
  const wbRels = wbRelsXml ? parseRelsXml(wbRelsXml, parser) : [];
  const wbRelMap = new Map<string, string>();
  for (const r of wbRels) {
    const id = (r as unknown as { Id?: unknown })?.Id;
    const target = (r as unknown as { Target?: unknown })?.Target;
    if (typeof id === "string" && typeof target === "string") wbRelMap.set(id, target);
  }

  const sheets = findSheetList(wbXml, parser);
  const results: ExtractedImage[] = [];

  for (const s of sheets) {
    const sheetName = (getProp(s, "name") ?? getProp(s, "@_name")) as string | undefined;
    if (!sheetName) continue;
    if (onlySheetName && sheetName !== onlySheetName) continue;

    const rid = (getProp(s, "r:id") ?? getProp(s, "@_r:id")) as string | undefined;
    const target = rid ? wbRelMap.get(rid) : undefined;
    if (!target) continue;

    // target like "worksheets/sheet1.xml"
    const sheetPath = `xl/${String(target).replace(/^\/+/, "")}`;
    const sheetRelsPath = `xl/${String(target).split("/").slice(0, -1).join("/")}/_rels/${String(target).split("/").slice(-1)[0]}.rels`;

    const sheetXmlBytes = entries.get(sheetPath);
    if (!sheetXmlBytes) continue;
    const sheetXml = Buffer.from(sheetXmlBytes).toString("utf8");
    const sheetDoc = parser.parse(sheetXml) as unknown;

    const worksheet = getProp(sheetDoc, "worksheet");
    const drawing = getProp(worksheet, "drawing");
    const drawingRid = (() => {
      if (Array.isArray(drawing)) {
        const d0 = drawing[0];
        return (getProp(d0, "r:id") ?? getProp(d0, "@_r:id")) as string | undefined;
      }
      return (getProp(drawing, "r:id") ?? getProp(drawing, "@_r:id")) as string | undefined;
    })();

    if (!drawingRid) continue;

    const sheetRelsBytes = entries.get(sheetRelsPath);
    const sheetRelsXml = sheetRelsBytes ? Buffer.from(sheetRelsBytes).toString("utf8") : "";
    const sheetRels = sheetRelsXml ? parseRelsXml(sheetRelsXml, parser) : [];
    const sheetRelMap = new Map<string, string>();
    for (const r of sheetRels) {
      const id = (r as unknown as { Id?: unknown })?.Id;
      const target = (r as unknown as { Target?: unknown })?.Target;
      if (typeof id === "string" && typeof target === "string") sheetRelMap.set(id, target);
    }

    const drawingTarget = sheetRelMap.get(drawingRid);
    if (!drawingTarget) continue;

    // drawingTarget often like "../drawings/drawing1.xml"
    const drawingPath = `xl/${drawingTarget}`.replace(/\\/g, "/");
    const drawingPathNormalized = drawingPath
      .replace("xl/..", "xl")
      .replace("xl/./", "xl/")
      .replace(/\/[^/]+\/\.\.\//g, "/");

    const drawingXmlBytes = entries.get(drawingPathNormalized);
    if (!drawingXmlBytes) continue;
    const drawingXml = Buffer.from(drawingXmlBytes).toString("utf8");
    const drawingDoc = parser.parse(drawingXml) as unknown;

    const root = (getProp(drawingDoc, "xdr:wsDr") ?? drawingDoc) as unknown;
    const anchors = [
      ...asArray(getProp(root, "xdr:twoCellAnchor")),
      ...asArray(getProp(root, "xdr:oneCellAnchor")),
    ];

    // drawing rels
    const drawingRelsPath = `${drawingPathNormalized}.rels`.replace("xl/drawings/", "xl/drawings/_rels/");
    const drawingRelsBytes = entries.get(drawingRelsPath);
    const drawingRelsXml = drawingRelsBytes ? Buffer.from(drawingRelsBytes).toString("utf8") : "";
    const drawingRels = drawingRelsXml ? parseRelsXml(drawingRelsXml, parser) : [];
    const drawingRelMap = new Map<string, string>();
    for (const r of drawingRels) {
      const id = (r as unknown as { Id?: unknown })?.Id;
      const target = (r as unknown as { Target?: unknown })?.Target;
      if (typeof id === "string" && typeof target === "string") drawingRelMap.set(id, target);
    }

    for (const anc of anchors) {
      const from = getProp(anc, "xdr:from") ?? getProp(anc, "from");
      const pic = getProp(anc, "xdr:pic") ?? getProp(anc, "pic");
      if (!from || !pic) continue;

      const row0 = Number(getProp(from, "xdr:row") ?? getProp(from, "row"));
      const col0 = Number(getProp(from, "xdr:col") ?? getProp(from, "col"));
      if (!Number.isFinite(row0) || !Number.isFinite(col0)) continue;

      const blipFill = getProp(pic, "xdr:blipFill") ?? getProp(pic, "blipFill");
      const blip = getProp(blipFill, "a:blip") ?? getProp(blipFill, "blip");
      const embed = (getProp(blip, "r:embed") ?? getProp(blip, "@_r:embed")) as string | undefined;
      if (!embed) continue;

      const mediaTarget = drawingRelMap.get(embed);
      if (!mediaTarget) continue;

      // mediaTarget like "../media/image1.png"
      const mediaRel = `xl/${String(mediaTarget).replace(/^\/+/, "")}`
        .replace("xl/..", "xl")
        .replace("xl/./", "xl/")
        .replace(/\/[^/]+\/\.\.\//g, "/")
        .replace(/\\/g, "/");

      const mediaBytes = entries.get(mediaRel);
      if (!mediaBytes) continue;

      results.push({
        sheetName,
        row0,
        col0,
        filename: mediaRel.split("/").slice(-1)[0] ?? "image",
        bytes: mediaBytes,
      });
    }
  }

  return results;
}

async function getPbAdmin() {
  const pbUrl = process.env.PB_URL;
  const email = process.env.PB_ADMIN_EMAIL;
  const pass = process.env.PB_ADMIN_PASSWORD;

  if (!pbUrl || !email || !pass) {
    throw new Error("Missing PB_URL / PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD env vars.");
  }

  const pb = new PocketBase(pbUrl);
  await pb.admins.authWithPassword(email, pass);
  return pb;
}

export async function POST(req: Request) {
  // CORS preflight handling
  const origin = req.headers.get('origin') ?? undefined;
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
  }
  try {
    const form = await req.formData();
    const file = form.get("source_file");
    const notes = String(form.get("notes") ?? "").trim();
    const createdBy = String(form.get("created_by") ?? "").trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing source_file" }, { status: 400, headers: corsHeaders(origin) });
    }

    const xlsxBytes = new Uint8Array(await file.arrayBuffer());

    // Parse first sheet rows (same as client does)
    const wb = XLSX.read(xlsxBytes, { type: "array" });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) return NextResponse.json({ error: "No sheet found" }, { status: 400 });
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: "", raw: true }) as Record<string, unknown>[];

    const unitsWithRow = rowsToAssetUnitsWithSourceRow(rows);
    if (!unitsWithRow.length) {
      return NextResponse.json({ error: "No valid rows parsed" }, { status: 400 });
    }

    const images = await extractEmbeddedImagesFromXlsx(xlsxBytes, sheetName);
    // Build: dataRowIndex (0-based) -> image (pick first if multiple)
    const imageByDataRowIndex = new Map<number, ExtractedImage>();
    for (const img of images) {
      const dataRowIndex = img.row0 - 1; // row0=0 is header row; sheet_to_json rows start from excel row2 => index 0
      if (dataRowIndex < 0) continue;
      if (!imageByDataRowIndex.has(dataRowIndex)) imageByDataRowIndex.set(dataRowIndex, img);
    }

    const pb = await getPbAdmin();

    const createdIds: string[] = [];
    const warnings: string[] = [];

    // Create asset_imports (best-effort)
    let importRecId: string | undefined;
    try {
      const importFd = new FormData();
      importFd.append("source_file", file, file.name);
      if (createdBy) importFd.append("created_by", createdBy);
      if (notes) importFd.append("notes", notes);
      const rec = await pb.collection("asset_imports").create(importFd);
      importRecId = rec.id;
      console.log("✅ Created asset_imports record with ID:", importRecId);
    } catch (e) {
      // Log error for debugging, but continue with import
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.error("❌ Failed to create asset_imports record:", errorMsg);
      warnings.push(`Asset imports record creation failed: ${errorMsg}`);
    }

    console.log("📋 importRecId before asset creation loop:", importRecId);

    for (const { unit, sourceRowIndex } of unitsWithRow) {
      const fd = new FormData();
      if (importRecId) {
        console.log(`📌 Adding import_ref=${importRecId} to asset row ${sourceRowIndex}`);
        fd.append("import_ref", importRecId);
      } else {
        console.log(`⚠️  No importRecId for asset row ${sourceRowIndex}`);
      }

      // append unit fields (except image_url; we use it only as fallback)
      for (const [k, v] of Object.entries(unit)) {
        if (v === undefined || v === null) continue;
        if (k === "image_url") continue;
        fd.append(k, typeof v === "string" ? v : String(v));
      }

      // Prefer embedded image mapped to this row
      const embedded = imageByDataRowIndex.get(sourceRowIndex);
      if (embedded) {
        const mime = extToMime(embedded.filename);
        const blob = new Blob([Buffer.from(embedded.bytes)], { type: mime });
        fd.append("image", blob, embedded.filename);
      } else {
        // Fallback: if unit.image_url is a URL/data URI, fetch and upload
        const src = unit.image_url?.trim();
        if (src && (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:"))) {
          try {
            const res = await fetch(src);
            const blob = await res.blob();
            fd.append("image", blob, `row_${sourceRowIndex + 1}.jpg`);
          } catch {
            warnings.push(`Failed to fetch image_url for row ${sourceRowIndex + 1}`);
          }
        }
      }

      // Debug: log FormData contents before creating
      console.log(`🔍 FormData entries for row ${sourceRowIndex}:`, Array.from(fd.entries()).map(([k, v]) => [k, v instanceof Blob ? `<Blob: ${(v as Blob).type}>` : v]));

      const created = await pb.collection("assets").create(fd);
      console.log(`✅ Created asset ${sourceRowIndex} with ID: ${created.id}, import_ref field:`, created.import_ref);
      createdIds.push(created.id);
    }

    return NextResponse.json({
      ok: true,
      sheetName,
      parsedRows: rows.length,
      validUnits: unitsWithRow.length,
      embeddedImagesFound: images.length,
      embeddedImagesMapped: imageByDataRowIndex.size,
      importRecId,
      createdIds,
      warnings,
    }, { headers: corsHeaders(origin) });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500, headers: corsHeaders(req.headers.get('origin') ?? undefined) });
  }
}
