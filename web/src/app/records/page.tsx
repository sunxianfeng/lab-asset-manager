'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { pb } from '@/lib/pocketbase';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/ui/Button';

type AuthModel = {
  id?: string;
  email?: string;
  username?: string;
  role?: string;
} | null;

type PbUserExpand = {
  id?: string;
  email?: string;
};

type PbLendRecord = {
  id?: string;
  user?: unknown;
  asset_group_key?: unknown;
  asset_description?: unknown;
  action?: unknown;
  created?: unknown;
  occurred_at?: unknown;
  expand?: {
    user?: PbUserExpand;
  };
};

interface LendRecord {
  id: string;
  userDisplay: string;
  userId?: string;
  userEmail?: string;
  asset_group_key?: string;
  asset_description: string;
  action: 'lend' | 'return';
  created: string;
  occurredAt: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function normalizeLendRecord(rec: PbLendRecord): LendRecord {
  const rawUser = rec?.user;
  const expandedUser = rec?.expand?.user;
  const userId =
    typeof rawUser === 'string' ? rawUser : isRecord(rawUser) ? String(rawUser.id ?? '') : '';
  const userEmail = expandedUser?.email ? String(expandedUser.email) : '';
  const userDisplay =
    userEmail ||
    (typeof rawUser === 'string' && rawUser.includes('@') ? rawUser : '') ||
    userId ||
    '未知用户';

  const created = typeof rec?.created === 'string' ? rec.created : new Date().toISOString();
  const occurredAt = typeof rec?.occurred_at === 'string' ? rec.occurred_at : created;

  return {
    id: String(rec?.id ?? ''),
    userDisplay,
    userId: userId || undefined,
    userEmail: userEmail || undefined,
    asset_group_key: rec?.asset_group_key ? String(rec.asset_group_key) : undefined,
    asset_description: String(rec?.asset_description ?? ''),
    action: rec?.action === 'return' ? 'return' : 'lend',
    created,
    occurredAt,
  };
}

function recordBelongsToUser(rec: PbLendRecord, authId: string, authEmail: string): boolean {
  const rawUser = rec?.user;
  const expandedUser = rec?.expand?.user;

  if (authId && rawUser === authId) return true;
  if (authEmail && rawUser === authEmail) return true;
  if (authId && expandedUser?.id === authId) return true;
  if (authEmail && expandedUser?.email === authEmail) return true;
  return false;
}

function toTimeValue(isoLike: string): number {
  const t = Date.parse(isoLike);
  return Number.isFinite(t) ? t : 0;
}

function getAssetKey(rec: LendRecord): string {
  const k = (rec.asset_group_key ?? '').trim();
  if (k) return k;
  return (rec.asset_description ?? '').trim();
}

function getUserKey(rec: LendRecord): string {
  return (rec.userId ?? rec.userEmail ?? rec.userDisplay ?? '').trim();
}

function getOutstandingLendRecords(all: LendRecord[]): LendRecord[] {
  // For each (user, asset), if lends exceed returns, show the latest outstanding lend.
  const byPair = new Map<string, LendRecord[]>();
  for (const rec of all) {
    const pairKey = `${getUserKey(rec)}\u0001${getAssetKey(rec)}`;
    const bucket = byPair.get(pairKey);
    if (bucket) bucket.push(rec);
    else byPair.set(pairKey, [rec]);
  }

  const outstanding: LendRecord[] = [];
  for (const bucket of byPair.values()) {
    bucket.sort((a, b) => toTimeValue(a.occurredAt) - toTimeValue(b.occurredAt));
    let balance = 0;
    let latestOutstandingLend: LendRecord | undefined;
    for (const rec of bucket) {
      if (rec.action === 'lend') {
        balance += 1;
        latestOutstandingLend = rec;
      } else {
        balance = Math.max(0, balance - 1);
        if (balance === 0) latestOutstandingLend = undefined;
      }
    }
    if (balance > 0 && latestOutstandingLend) outstanding.push(latestOutstandingLend);
  }

  outstanding.sort((a, b) => toTimeValue(b.occurredAt) - toTimeValue(a.occurredAt));
  return outstanding;
}

export default function RecordsPage() {
  const [records, setRecords] = useState<LendRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOutstandingOnly, setShowOutstandingOnly] = useState(false);
  const router = useRouter();
  const authRecord = pb.authStore.model as AuthModel;
  const isAdmin = authRecord?.role === 'admin';
  const authId = String(authRecord?.id ?? '');
  const authEmail = String(authRecord?.email ?? '');

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/auth/login');
      return;
    }
    
    // Use a flag to prevent state updates after unmount
    let cancelled = false;
    
    async function loadRecords() {
      try {
        // Disable auto-cancellation for this request
        const allResults = await pb.collection('lend_records').getList<PbLendRecord>(1, 500, {
          sort: '-created',
          expand: 'user',
          requestKey: null, // Disable auto-cancellation completely
        });
        
        if (cancelled) return;
        
        let results;
        if (isAdmin) {
          results = allResults;
        } else {
          if (!authId && !authEmail) {
            setRecords([]);
            setLoading(false);
            return;
          }
          results = {
            ...allResults,
            items: allResults.items.filter((item) => recordBelongsToUser(item, authId, authEmail)),
          };
        }

        const normalized = results.items.map(normalizeLendRecord);
        setRecords(normalized);
        console.log(`Loaded ${normalized.length} records`);
      } catch (err: unknown) {
        if (cancelled) return;
        
        const msg = err instanceof Error ? err.message : String(err);
        const status = (err as { status?: unknown } | null | undefined)?.status;
        
        // Only log non-trivial errors
        if (!msg.includes('autocancelled') && status !== 0) {
          console.error('Failed to fetch lend_records:', { message: msg, status });
        }
        
        setRecords([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    
    loadRecords();
    
    return () => {
      cancelled = true;
    };
  }, [router, isAdmin, authId, authEmail]);

  const visibleRecords = showOutstandingOnly ? getOutstandingLendRecords(records) : records;

  return (
    <AppShell
      title="借还记录"
      actions={
        <div className="flex gap-2">
          <Button
            variant={showOutstandingOnly ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setShowOutstandingOnly((v) => !v)}
          >
            {showOutstandingOnly ? '显示全部' : '查看未归还'}
          </Button>
        </div>
      }
    >
      {loading ? (
        <p>加载中...</p>
      ) : visibleRecords.length === 0 ? (
        <div className="bg-white/60 backdrop-blur-[20px] rounded-3xl p-6 text-center text-gray-500">
          <p>{showOutstandingOnly ? '暂无借出未归还记录' : '暂无借还记录'}</p>
        </div>
      ) : (
        <div className="bg-white/60 backdrop-blur-[20px] rounded-3xl p-6">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3 font-semibold">用户</th>
                <th className="text-left p-3 font-semibold">资产</th>
                <th className="text-left p-3 font-semibold">操作</th>
                <th className="text-left p-3 font-semibold">日期</th>
              </tr>
            </thead>
            <tbody>
              {visibleRecords.map((rec) => (
                <tr key={rec.id} className="border-b hover:bg-zinc-50/50">
                  <td className="p-3">{rec.userDisplay}</td>
                  <td className="p-3">{rec.asset_description}</td>
                  <td className="p-3">{rec.action === 'lend' ? '借出' : '归还'}</td>
                  <td className="p-3">{new Date(rec.created).toLocaleString('zh-CN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}

