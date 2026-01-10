'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { pb } from '@/lib/pocketbase';
import { AppShell } from '@/components/AppShell';

interface LendRecord {
  id: string;
  user: string;
  asset_description: string;
  action: 'lend' | 'return';
  created: string;
}

function normalizeLendRecord(rec: any): LendRecord {
  const userValue =
    typeof rec?.user === 'string'
      ? rec.user
      : rec?.expand?.user?.username || rec?.expand?.user?.email || '未知用户';

  return {
    id: String(rec?.id ?? ''),
    user: String(userValue ?? ''),
    asset_description: String(rec?.asset_description ?? ''),
    action: rec?.action === 'return' ? 'return' : 'lend',
    created: String(rec?.created ?? new Date().toISOString()),
  };
}

function buildMockRecords(params: { viewerLabel: string; isAdmin: boolean }): LendRecord[] {
  const now = Date.now();
  const make = (
    i: number,
    data: Pick<LendRecord, 'user' | 'asset_description' | 'action'> & { createdOffsetMs: number },
  ): LendRecord => ({
    id: `mock-${i}`,
    user: data.user,
    asset_description: data.asset_description,
    action: data.action,
    created: new Date(now - data.createdOffsetMs).toISOString(),
  });

  // If not admin, keep the mock rows scoped to the current viewer.
  const u = params.viewerLabel || '我';
  return [
    make(1, {
      user: params.isAdmin ? '测试用户A' : u,
      asset_description: '示波器（测试数据）',
      action: 'lend',
      createdOffsetMs: 60 * 60 * 1000,
    }),
    make(2, {
      user: params.isAdmin ? '测试用户A' : u,
      asset_description: '万用表（测试数据）',
      action: 'return',
      createdOffsetMs: 2 * 60 * 60 * 1000,
    }),
    make(3, {
      user: params.isAdmin ? '测试用户B' : u,
      asset_description: '电源（测试数据）',
      action: 'lend',
      createdOffsetMs: 24 * 60 * 60 * 1000,
    }),
  ];
}

export default function RecordsPage() {
  const [records, setRecords] = useState<LendRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const authRecord = pb.authStore.model;
  const isAdmin = authRecord?.role === 'admin';

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/auth/login');
      return;
    }
    loadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, isAdmin]);

  async function loadRecords() {
    try {
      const filter = isAdmin ? '' : `user="${authRecord!.id}"`;
      const results = await pb.collection('lend_records').getFullList({
        filter,
        sort: '-created',
        expand: 'user',
      });

      const normalized = (results as any[]).map(normalizeLendRecord);
      if (normalized.length === 0) {
        const viewerLabel =
          (authRecord as any)?.username || (authRecord as any)?.email || (authRecord as any)?.id || '我';
        setRecords(buildMockRecords({ viewerLabel, isAdmin }));
      } else {
        setRecords(normalized);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const status = (err as any)?.status;
      
      // Treat 404 (collection not found) as empty result
      if (msg.includes('Missing collection context') || status === 404) {
        console.warn('lend_records collection not found, showing mock data');
        const viewerLabel =
          (authRecord as any)?.username || (authRecord as any)?.email || (authRecord as any)?.id || '我';
        setRecords(buildMockRecords({ viewerLabel, isAdmin }));
        return;
      }
      
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <h1 className="text-4xl font-bold text-zinc-900 mb-8">借还记录</h1>

      {loading ? (
        <p>加载中...</p>
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
              {records.map((rec) => (
                <tr key={rec.id} className="border-b hover:bg-zinc-50/50">
                  <td className="p-3">{rec.user}</td>
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

