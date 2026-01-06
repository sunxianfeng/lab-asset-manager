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
  description: string;
  total: number;
  available: number;
  borrowed: number;
}

export default function AssetsPage() {
  const [groups, setGroups] = useState<AssetGrouped[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const authRecord = pb.authStore.model;
  const isAdmin = authRecord?.role === 'admin';

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/auth/login');
      return;
    }
    loadAssets();
  }, [router]);

  async function loadAssets() {
    try {
      const records = await pb.collection('assets').getFullList();
      const grouped: Record<string, AssetGrouped> = {};
      for (const rec of records) {
        const desc = rec.asset_description || 'Unknown';
        if (!grouped[desc]) {
          grouped[desc] = { description: desc, total: 0, available: 0, borrowed: 0 };
        }
        grouped[desc].total++;
        if (rec.current_holder) {
          grouped[desc].borrowed++;
        } else {
          grouped[desc].available++;
        }
      }
      setGroups(Object.values(grouped));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleBorrow(description: string) {
    try {
      await pb.collection('lend_records').create({
        user: authRecord!.id,
        asset_description: description,
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

  async function handleReturn(description: string) {
    try {
      await pb.collection('lend_records').create({
        user: authRecord!.id,
        asset_description: description,
        action: 'return',
      });
      loadAssets(); // Refresh
    } catch (err: unknown) {
      alert('Return failed: ' + (err instanceof Error ? err.message : ''));
    }
  }

  async function checkIfUserHoldAsset(description: string): Promise<boolean> {
    try {
      const records = await pb.collection('assets').getFullList({
        filter: `asset_description="${description}" && current_holder="${authRecord!.id}"`,
      });
      return records.length > 0;
    } catch {
      return false;
    }
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-bold text-black dark:text-white">资产总览</h1>
        {isAdmin && (
          <Link href="/assets/import">
            <Button>导入资产</Button>
          </Link>
        )}
      </div>

      {loading ? (
        <p>加载中...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group) => (
            <Card key={group.description} className="p-0 overflow-hidden flex flex-col">
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
                    onClick={() => handleBorrow(group.description)}
                  >
                    借出
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={async () => {
                      const holds = await checkIfUserHoldAsset(group.description);
                      if (holds) {
                        handleReturn(group.description);
                      } else {
                        alert('您没有借用此类型的资产');
                      }
                    }}
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

