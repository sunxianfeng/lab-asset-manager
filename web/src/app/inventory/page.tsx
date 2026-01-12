'use client';

import { useEffect, useMemo, useState } from 'react';

import { AppShell } from '@/components/AppShell';
import { pb } from '@/lib/pocketbase';
import { Badge } from '@/components/ui/Badge';

interface AssetRecord {
  id: string;
  group_key?: string;
  is_fixed_assets?: string | boolean;
  category?: string;
  asset_description?: string;
  serial_no?: string;
  location?: string;
  current_holder?: string;
  expand?: {
    current_holder?: {
      id: string;
      email?: string;
      username?: string;
      name?: string;
    };
  };
  manufacturer?: string;
  value_cny?: number | string;
  commissioning_time?: string;
  metrology_validity_period?: string;
  metrology_requirement?: string;
  metrology_cost?: number | string;
  scrapped?: boolean;
}

interface InventoryGroup {
  groupKey: string;
  total: number;
  available: number;
  scrapped: number;
  latestMetrologyDate?: string;
  borrowers: string[];
  items: AssetRecord[];
}

function asText(v: unknown): string {
  if (v === null || v === undefined) return '-';
  const s = String(v).trim();
  return s ? s : '-';
}

function asYesNo(v: unknown): string {
  if (v === true) return 'Yes';
  if (v === false) return 'No';
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return '-';
  if (s === 'yes' || s === 'y' || s === 'true' || s === '1') return 'Yes';
  if (s === 'no' || s === 'n' || s === 'false' || s === '0') return 'No';
  // Some sheets might use CN labels
  if (s.includes('是')) return 'Yes';
  if (s.includes('否')) return 'No';
  return asText(v);
}

function asDateLabel(v: unknown): string {
  const s = String(v ?? '').trim();
  if (!s) return '-';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return asText(v);
  // ISO-like YYYY-MM-DD
  return d.toISOString().slice(0, 10);
}

function holderLabel(rec: AssetRecord): string {
  const expanded = rec.expand?.current_holder;
  if (expanded) {
    const preferred = expanded.name || expanded.username || expanded.email || expanded.id;
    return asText(preferred);
  }
  return asText(rec.current_holder);
}

function includesText(haystack: unknown, needle: string): boolean {
  const h = String(haystack ?? '').toLowerCase();
  return h.includes(needle);
}

export default function InventoryPage() {
  const [records, setRecords] = useState<AssetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [hideScrapped, setHideScrapped] = useState(true);
  const [onlyBorrowed, setOnlyBorrowed] = useState(false);
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        // Keep consistent with other pages: paginated request with a reasonable limit.
        const result = await pb.collection('assets').getList<AssetRecord>(1, 500, {
          requestKey: 'inventory-assets-list',
          expand: 'current_holder',
        });
        if (!alive) return;
        setRecords(result.items ?? []);
      } catch (e: unknown) {
        if (!alive) return;
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        setRecords([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, []);

  const filteredRecords = useMemo(() => {
    const q = query.trim().toLowerCase();

    return records.filter((rec) => {
      if (hideScrapped && rec.scrapped === true) return false;

      const isBorrowed = Boolean(rec.current_holder);
      const isAvailable = rec.scrapped !== true && !rec.current_holder;

      if (onlyBorrowed && !isBorrowed) return false;
      if (onlyAvailable && !isAvailable) return false;

      if (!q) return true;

      const groupKey = String(rec.group_key ?? rec.asset_description ?? '').trim();
      const fields = [
        groupKey,
        rec.asset_description,
        rec.serial_no,
        rec.category,
        rec.location,
        holderLabel(rec),
        rec.manufacturer,
      ];
      return fields.some((f) => includesText(f, q));
    });
  }, [records, query, hideScrapped, onlyBorrowed, onlyAvailable]);

  const groups: InventoryGroup[] = useMemo(() => {
    const map: Record<string, InventoryGroup> = {};
    for (const rec of filteredRecords) {
      const groupKey = String(rec.group_key ?? rec.asset_description ?? '').trim() || 'Unknown';
      if (!map[groupKey]) {
        map[groupKey] = { groupKey, total: 0, available: 0, scrapped: 0, borrowers: [], items: [] };
      }
      map[groupKey].total++;
      map[groupKey].items.push(rec);

      if (rec.scrapped === true) {
        map[groupKey].scrapped++;
      }

      if (rec.current_holder) {
        const label = holderLabel(rec);
        if (label !== '-' && !map[groupKey].borrowers.includes(label)) {
          map[groupKey].borrowers.push(label);
        }
      }

      // Best-effort “last metrology time” using the existing date fields.
      // The schema does not have a dedicated “last_metrology_time”; we use the latest
      // `metrology_validity_period` (if any), otherwise fall back to `commissioning_time`.
      const candidate = rec.metrology_validity_period || rec.commissioning_time;
      if (candidate) {
        const dt = new Date(candidate);
        if (!Number.isNaN(dt.getTime())) {
          const current = map[groupKey].latestMetrologyDate ? new Date(map[groupKey].latestMetrologyDate) : null;
          if (!current || dt.getTime() > current.getTime()) {
            map[groupKey].latestMetrologyDate = dt.toISOString();
          }
        }
      }

      // Match assets page logic:
      // - total counts all records
      // - available counts: not scrapped AND no current_holder
      if (rec.scrapped === true) continue;
      if (rec.current_holder) continue;
      map[groupKey].available++;
    }

    return Object.values(map)
      .map((g) => ({
        ...g,
        items: [...g.items].sort((a, b) => asText(a.serial_no).localeCompare(asText(b.serial_no))),
      }))
      .sort((a, b) => a.groupKey.localeCompare(b.groupKey));
  }, [filteredRecords]);

  return (
    <AppShell title="资产盘点">
      <div className="bg-white/60 backdrop-blur-[20px] rounded-3xl p-6">
        <div className="mb-5 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-(--app-muted)">Filter</label>
            <input
              className="h-10 w-[320px] rounded-xl border border-(--app-border) bg-white/70 px-3 text-sm outline-none focus:ring-2 focus:ring-black/10"
              placeholder="按 group_key / Serial No / location / holder 搜索..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground select-none">
            <input
              type="checkbox"
              checked={hideScrapped}
              onChange={(e) => setHideScrapped(e.target.checked)}
            />
            隐藏报废
          </label>

          <label className="flex items-center gap-2 text-sm text-foreground select-none">
            <input
              type="checkbox"
              checked={onlyBorrowed}
              onChange={(e) => {
                setOnlyBorrowed(e.target.checked);
                if (e.target.checked) setOnlyAvailable(false);
              }}
            />
            仅借出
          </label>

          <label className="flex items-center gap-2 text-sm text-foreground select-none">
            <input
              type="checkbox"
              checked={onlyAvailable}
              onChange={(e) => {
                setOnlyAvailable(e.target.checked);
                if (e.target.checked) setOnlyBorrowed(false);
              }}
            />
            仅可用
          </label>
        </div>

        {loading ? (
          <p className="text-(--app-muted)">加载中...</p>
        ) : error ? (
          <div className="space-y-2">
            <p className="text-red-600">加载失败：{error}</p>
            <p className="text-(--app-muted)">请确认 PocketBase 已启动且 assets 集合存在。</p>
          </div>
        ) : groups.length === 0 ? (
          <p className="text-(--app-muted)">暂无资产数据</p>
        ) : (
          <div className="space-y-6">
            {groups.map((g) => (
              <section key={g.groupKey} className="rounded-2xl border border-(--app-border) bg-white/70">
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-(--app-border)">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-[16px] font-semibold text-foreground">{g.groupKey}</span>
                    <Badge tone="blue">总数 {g.total}</Badge>
                    <Badge tone="green">available {g.available}</Badge>
                    <Badge tone="red">报废 {g.scrapped}</Badge>
                    <Badge tone="blue">上一次计量时间 {g.latestMetrologyDate ? asDateLabel(g.latestMetrologyDate) : '-'}</Badge>
                  </div>
                </div>

                {g.borrowers.length > 0 ? (
                  <div className="px-5 py-3 text-sm">
                    <span className="text-(--app-muted)">借阅人集合：</span>
                    <span className="text-foreground">{g.borrowers.join('，')}</span>
                  </div>
                ) : (
                  <div className="px-5 py-3 text-sm">
                    <span className="text-(--app-muted)">借阅人集合：</span>
                    <span className="text-foreground">-</span>
                  </div>
                )}

                <div className="w-full overflow-x-auto">
                  <table className="min-w-350 w-full text-sm">
                    <thead className="bg-white/60">
                      <tr className="text-left text-(--app-muted)">
                        <th className="px-4 py-3 font-medium">Is Fixed Assets</th>
                        <th className="px-4 py-3 font-medium">Category</th>
                        <th className="px-4 py-3 font-medium">Asset description</th>
                        <th className="px-4 py-3 font-medium">Serial No</th>
                        <th className="px-4 py-3 font-medium">location</th>
                        <th className="px-4 py-3 font-medium">current_holder</th>
                        <th className="px-4 py-3 font-medium">Manufacturer</th>
                        <th className="px-4 py-3 font-medium">Value (CNY)</th>
                        <th className="px-4 py-3 font-medium">Commissioning Time</th>
                        <th className="px-4 py-3 font-medium">Metrology Validity Period</th>
                        <th className="px-4 py-3 font-medium">Metrology Requirement</th>
                        <th className="px-4 py-3 font-medium">Metrology Cost</th>
                        <th className="px-4 py-3 font-medium">current_holder</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.items.map((item) => (
                        <tr key={item.id} className="border-t border-(--app-border) hover:bg-white/60">
                          <td className="px-4 py-3">{asYesNo(item.is_fixed_assets)}</td>
                          <td className="px-4 py-3">{asText(item.category)}</td>
                          <td className="px-4 py-3">{asText(item.asset_description)}</td>
                          <td className="px-4 py-3">{asText(item.serial_no)}</td>
                          <td className="px-4 py-3">{asText(item.location)}</td>
                          <td className="px-4 py-3">{asText(item.current_holder)}</td>
                          <td className="px-4 py-3">{asText(item.manufacturer)}</td>
                          <td className="px-4 py-3">{asText(item.value_cny)}</td>
                          <td className="px-4 py-3">{asText(item.commissioning_time)}</td>
                          <td className="px-4 py-3">{asText(item.metrology_validity_period)}</td>
                          <td className="px-4 py-3">{asText(item.metrology_requirement)}</td>
                          <td className="px-4 py-3">{asText(item.metrology_cost)}</td>
                          <td className="px-4 py-3">{asText(item.current_holder)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}