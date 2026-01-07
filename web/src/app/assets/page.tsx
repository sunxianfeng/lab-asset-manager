'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { pb } from '@/lib/pocketbase';
import { AppShell } from '@/components/AppShell';
import { Card, CardImage } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface AssetGrouped {
  groupKey: string;
  description: string;
  total: number;
  available: number;
  borrowed: number;
}

export default function AssetsPage() {
  const [groups, setGroups] = useState<AssetGrouped[]>([]);
  const [loading, setLoading] = useState(true);
  const [holdGroupKeys, setHoldGroupKeys] = useState<Set<string>>(new Set());
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    setMounted(true);
    const authRecord = pb.authStore.model;
    setIsAdmin(authRecord?.role === 'admin');
  }, []);

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/auth/login');
      return;
    }
    loadAssets();
  }, [router]);

  async function loadAssets() {
    try {
      const authRecord = pb.authStore.model;
      const records = await pb.collection('assets').getFullList();
      const grouped: Record<string, AssetGrouped> = {};
      for (const rec of records) {
        const groupKey = String((rec as any)?.group_key ?? '');
        const desc = (rec as any).asset_description || 'Unknown';
        const key = groupKey || desc;
        if (!grouped[key]) {
          grouped[key] = { groupKey, description: desc, total: 0, available: 0, borrowed: 0 };
        }
        grouped[key].total++;
        if (rec.current_holder) {
          grouped[key].borrowed++;
        } else {
          grouped[key].available++;
        }
      }
      setGroups(Object.values(grouped));

      if (!authRecord?.id) {
        setHoldGroupKeys(new Set());
        return;
      }
      const held = await pb.collection('assets').getFullList({
        filter: `current_holder="${authRecord!.id}"`,
      });
      setHoldGroupKeys(new Set((held as any[]).map((r) => String(r?.group_key ?? ''))));
    } catch (err: unknown) {
      // PocketBase JS SDK may autocancel requests in some dev/runtime situations
      // (ClientResponseError 0). Treat autocancelled requests as "no data".
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('autocancel') || msg.includes('ClientResponseError') || msg.includes('request was autocancelled')) {
        console.warn('assets.getFullList autocancelled, treating as empty list');
        setGroups([]);
        setHoldGroupKeys(new Set());
        return;
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleBorrow(params: { groupKey: string; description: string }) {
    try {
      const authRecord = pb.authStore.model;
      if (!authRecord?.id) {
        router.push('/auth/login');
        return;
      }
      await pb.collection('lend_records').create({
        user: authRecord!.id,
        asset_group_key: params.groupKey,
        asset_description: params.description,
        action: 'lend',
      });
      loadAssets(); // Refresh

      // Trigger door open if connected
      try {
        const { openDoor, isConnected } = await import('@/lib/door/doorController');
        if (await isConnected()) {
          await openDoor();
          alert('Borrow successful! Cabinet door opened.');
        } else {
          alert('Borrow successful! (Door controller not connected)');
        }
      } catch (doorErr) {
        console.warn('Door open failed:', doorErr);
        alert('Borrow successful, but door open failed. Check the kiosk connection.');
      }
    } catch (err: unknown) {
      alert('Borrow failed: ' + (err instanceof Error ? err.message : ''));
    }
  }

  async function handleReturn(params: { groupKey: string; description: string }) {
    try {
      const authRecord = pb.authStore.model;
      if (!authRecord?.id) {
        router.push('/auth/login');
        return;
      }
      await pb.collection('lend_records').create({
        user: authRecord!.id,
        asset_group_key: params.groupKey,
        asset_description: params.description,
        action: 'return',
      });
      loadAssets(); // Refresh
    } catch (err: unknown) {
      alert('Return failed: ' + (err instanceof Error ? err.message : ''));
    }
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-bold text-black dark:text-white">资产总览</h1>
        {mounted && isAdmin && (
          <Link
            href="/assets/import"
            className={
              "inline-flex items-center justify-center gap-2 rounded-[14px] font-semibold tracking-tight " +
              "transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent " +
              "select-none bg-[var(--accent)] text-white hover:brightness-95 active:brightness-90 h-11 px-4 text-[15px]"
            }
          >
            导入资产
          </Link>
        )}
      </div>

      {loading ? (
        <p>加载中...</p>
      ) : (
        <div className="grid gap-6 grid-cols-[repeat(auto-fit,minmax(280px,1fr))]">
          {groups.map((group) => (
            <Card key={group.groupKey || group.description} className="p-0 overflow-hidden flex flex-col">
              <CardImage className="rounded-none rounded-t-[24px]" />
              <div className="p-5 flex flex-col gap-3 flex-1">
                <h2 className="text-lg font-bold text-black dark:text-white">{group.description}</h2>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="green">可借 {group.available}</Badge>
                  <Badge tone="blue">已借 {group.borrowed}</Badge>
                </div>
                <div className="flex gap-2 mt-auto pt-2">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={group.available === 0}
                    onClick={() => handleBorrow({ groupKey: group.groupKey, description: group.description })}
                  >
                    借出
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!group.groupKey || !holdGroupKeys.has(group.groupKey)}
                    onClick={() => handleReturn({ groupKey: group.groupKey, description: group.description })}
                  >
                    归还
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}

