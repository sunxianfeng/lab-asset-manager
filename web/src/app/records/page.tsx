'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { pb } from '@/lib/pocketbase';
import { AppShell } from '@/components/AppShell';

interface LendRecord {
  id: string;
  userDisplay: string;
  userId?: string;
  userEmail?: string;
  asset_description: string;
  action: 'lend' | 'return';
  created: string;
}

function normalizeLendRecord(rec: any): LendRecord {
  const rawUser = rec?.user;
  const expandedUser = rec?.expand?.user;
  const userId = typeof rawUser === 'string' ? rawUser : String(rawUser?.id ?? '');
  const userEmail = expandedUser?.email ? String(expandedUser.email) : '';
  const userDisplay =
    userEmail ||
    (typeof rawUser === 'string' && rawUser.includes('@') ? rawUser : '') ||
    userId ||
    '未知用户';

  return {
    id: String(rec?.id ?? ''),
    userDisplay,
    userId: userId || undefined,
    userEmail: userEmail || undefined,
    asset_description: String(rec?.asset_description ?? ''),
    action: rec?.action === 'return' ? 'return' : 'lend',
    created: String(rec?.created ?? new Date().toISOString()),
  };
}

function recordBelongsToUser(rec: any, authRecord: any): boolean {
  const authId = String(authRecord?.id ?? '');
  const authEmail = String(authRecord?.email ?? '');
  const rawUser = rec?.user;
  const expandedUser = rec?.expand?.user;

  if (authId && rawUser === authId) return true;
  if (authEmail && rawUser === authEmail) return true;
  if (authId && expandedUser?.id === authId) return true;
  if (authEmail && expandedUser?.email === authEmail) return true;
  return false;
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
          expand: 'user',
          requestKey: null, // Disable auto-cancellation completely
        });
        
        if (cancelled) return;
        
        let results;
        if (isAdmin) {
          results = allResults;
        } else {
          const userId = String((authRecord as any)?.id ?? '');
          const userEmail = String((authRecord as any)?.email ?? '');
          if (!userId && !userEmail) {
            setRecords([]);
            setLoading(false);
            return;
          }
          results = {
            ...allResults,
            items: allResults.items.filter((item: any) => recordBelongsToUser(item, authRecord)),
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

