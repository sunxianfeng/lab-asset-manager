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
      setRecords(results as unknown as LendRecord[]);
    } catch (err) {
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
        <div className="bg-white/60 backdrop-blur-[20px] rounded-[24px] p-6">
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

