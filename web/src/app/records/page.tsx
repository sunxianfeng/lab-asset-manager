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
  // The user field is now text (stores email directly)
  return {
    id: String(rec?.id ?? ''),
    user: String(rec?.user ?? '未知用户'),
    asset_description: String(rec?.asset_description ?? ''),
    action: rec?.action === 'return' ? 'return' : 'lend',
    created: String(rec?.created ?? new Date().toISOString()),
  };
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
    
    // Use a flag to prevent state updates after unmount
    let cancelled = false;
    
    async function loadRecords() {
      try {
        // Disable auto-cancellation for this request
        const allResults = await pb.collection('lend_records').getList(1, 500, {
          sort: '-created',
          requestKey: null, // Disable auto-cancellation completely
        });
        
        if (cancelled) return;
        
        let results;
        if (isAdmin) {
          results = allResults;
        } else {
          const userEmail = (authRecord as any)?.email;
          if (!userEmail) {
            setRecords([]);
            setLoading(false);
            return;
          }
          results = {
            ...allResults,
            items: allResults.items.filter((item: any) => item.user === userEmail),
          };
        }

        const normalized = (results.items as any[]).map(normalizeLendRecord);
        setRecords(normalized);
        console.log(`Loaded ${normalized.length} records`);
      } catch (err: unknown) {
        if (cancelled) return;
        
        const msg = err instanceof Error ? err.message : String(err);
        const status = (err as any)?.status;
        
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
  }, [router, authRecord?.id, isAdmin]);

  return (
    <AppShell>
      <h1 className="text-4xl font-bold text-zinc-900 mb-8">借还记录</h1>

      {loading ? (
        <p>加载中...</p>
      ) : records.length === 0 ? (
        <div className="bg-white/60 backdrop-blur-[20px] rounded-3xl p-6 text-center text-gray-500">
          <p>暂无借还记录</p>
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

