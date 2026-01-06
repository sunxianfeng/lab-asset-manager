'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { pb } from '@/lib/pocketbase';
import { AppShell } from '@/components/AppShell';
import { Card } from '@/components/ui/Card';
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
        <h1 className="text-4xl font-bold">Assets</h1>
        {isAdmin && (
          <Link href="/assets/import">
            <Button>Import Assets</Button>
          </Link>
        )}
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group) => (
            <Card key={group.description} className="p-6 flex flex-col gap-4">
              <h2 className="text-xl font-semibold">{group.description}</h2>
              <div className="flex gap-2">
                <Badge variant="success">{group.available} Available</Badge>
                <Badge variant="warning">{group.borrowed} Borrowed</Badge>
              </div>
              <div className="flex gap-2 mt-auto">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={group.available === 0}
                  onClick={() => handleBorrow(group.description)}
                >
                  Borrow
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    const holds = await checkIfUserHoldAsset(group.description);
                    if (holds) {
                      handleReturn(group.description);
                    } else {
                      alert('You do not have any borrowed asset of this type');
                    }
                  }}
                >
                  Return
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}

