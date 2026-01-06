import * as XLSX from 'xlsx';
import { pb } from '@/lib/pocketbase';

export interface AssetUnit {
  is_fixed_assets?: string;
  category?: string;
  asset_description?: string;
  serial_no?: string;
  location?: string;
  user?: string;
  manufacturer?: string;
  value_cny?: number | string;
  commissioning_time?: string;
  metrology_validity_period?: string;
  metrology_requirement?: string;
  metrology_cost?: number | string;
  remarks?: string;
  asset_name?: string;
  current_holder?: string;
}

export async function exportAssetsToExcel(): Promise<void> {
  // Fetch all asset units
  const records = await pb.collection('assets').getFullList();

  // Transform to Excel-friendly structure
  const data: AssetUnit[] = records.map((rec) => ({
    is_fixed_assets: rec.is_fixed_assets || '',
    category: rec.category || '',
    asset_description: rec.asset_description || '',
    serial_no: rec.serial_no || '',
    location: rec.location || '',
    user: rec.user || '',
    manufacturer: rec.manufacturer || '',
    value_cny: rec.value_cny || '',
    commissioning_time: rec.commissioning_time || '',
    metrology_validity_period: rec.metrology_validity_period || '',
    metrology_requirement: rec.metrology_requirement || '',
    metrology_cost: rec.metrology_cost || '',
    remarks: rec.remarks || '',
    asset_name: rec.asset_name || '',
    current_holder: rec.current_holder || '',
  }));

  // Create workbook
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Assets');

  // Trigger download
  const timestamp = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `assets_export_${timestamp}.xlsx`);
}

