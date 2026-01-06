import * as XLSX from "xlsx";

export type RawAssetRow = Record<string, unknown>;

export type AssetUnitCreate = {
  is_fixed_assets?: boolean;
  category?: string;
  asset_description: string;
  serial_no?: string;
  location?: string;
  excel_user?: string;
  manufacturer?: string;
  value_cny?: number;
  commissioning_time?: string;
  metrology_validity_period?: string;
  metrology_requirement?: string;
  metrology_cost?: number;
  remarks?: string;
  asset_name?: string;
  group_key: string;
  status: "available" | "borrowed";
  import_ref?: string;
};

const headerMap: Record<string, keyof AssetUnitCreate> = {
  "Is Fixed Assets": "is_fixed_assets",
  Category: "category",
  "Asset description": "asset_description",
  "Serial No": "serial_no",
  location: "location",
  user: "excel_user",
  Manufacturer: "manufacturer",
  "Value (CNY)": "value_cny",
  "Commissioning Time": "commissioning_time",
  "Metrology Validity Period": "metrology_validity_period",
  "Metrology Requirement": "metrology_requirement",
  "Metrology Cost": "metrology_cost",
  Remarks: "remarks",
};

function asString(v: unknown) {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

function asNumber(v: unknown) {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function asBool(v: unknown) {
  if (typeof v === "boolean") return v;
  const s = asString(v)?.toLowerCase();
  if (!s) return undefined;
  if (["y", "yes", "true", "1", "固定资产"].includes(s)) return true;
  if (["n", "no", "false", "0", "非固定资产"].includes(s)) return false;
  return undefined;
}

function asDateISO(v: unknown) {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString();
  if (typeof v === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return undefined;
    const dt = new Date(Date.UTC(d.y, d.m - 1, d.d, d.H, d.M, d.S));
    if (!Number.isNaN(dt.getTime())) return dt.toISOString();
  }
  const s = asString(v);
  if (!s) return undefined;
  const dt = new Date(s);
  if (!Number.isNaN(dt.getTime())) return dt.toISOString();
  return undefined;
}

export function normalizeGroupKey(assetDescription: string) {
  return assetDescription.trim().replace(/\s+/g, " ");
}

export function parseAssetFile(file: File): Promise<RawAssetRow[]> {
  return file.arrayBuffer().then((buf) => {
    const wb = XLSX.read(buf, { type: "array" });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) return [];
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: "" }) as RawAssetRow[];
    return rows;
  });
}

export function rowsToAssetUnits(rows: RawAssetRow[]): AssetUnitCreate[] {
  const units: AssetUnitCreate[] = [];

  for (const row of rows) {
    const unit: Partial<AssetUnitCreate> = {
      status: "available",
      asset_name: "",
    };

    for (const [header, value] of Object.entries(row)) {
      const key = headerMap[header];
      if (!key) continue;

      switch (key) {
        case "value_cny":
          unit.value_cny = asNumber(value);
          break;
        case "metrology_cost":
          unit.metrology_cost = asNumber(value);
          break;
        case "is_fixed_assets":
          unit.is_fixed_assets = asBool(value);
          break;
        case "commissioning_time":
          unit.commissioning_time = asDateISO(value);
          break;
        case "metrology_validity_period":
          unit.metrology_validity_period = asDateISO(value);
          break;
        case "category":
          unit.category = asString(value);
          break;
        case "asset_description":
          unit.asset_description = asString(value) ?? "";
          break;
        case "serial_no":
          unit.serial_no = asString(value);
          break;
        case "location":
          unit.location = asString(value);
          break;
        case "excel_user":
          unit.excel_user = asString(value);
          break;
        case "manufacturer":
          unit.manufacturer = asString(value);
          break;
        case "metrology_requirement":
          unit.metrology_requirement = asString(value);
          break;
        case "remarks":
          unit.remarks = asString(value);
          break;
        default:
          break;
      }
    }

    const desc = unit.asset_description?.trim();
    if (!desc) continue;

    unit.asset_description = desc;
    unit.group_key = normalizeGroupKey(desc);

    units.push(unit as AssetUnitCreate);
  }

  return units;
}


