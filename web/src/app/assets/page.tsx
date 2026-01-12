'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { pb } from '@/lib/pocketbase';
import { AppShell } from '@/components/AppShell';
import { Card, CardImage } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { RenameAssetModal } from '@/components/RenameAssetModal';

interface AssetGrouped {
  groupKey: string;
  description: string;
  total: number;
  available: number;
  borrowed: number;
  imageUrl?: string;
}

// Narrow asset record type used by this page to avoid `any`.
interface AssetRecord {
  id: string;
  group_key?: string;
  asset_description?: string;
  current_holder?: string;
  image?: string;
  // Optional fields used elsewhere in app/export
  is_fixed_assets?: string;
  category?: string;
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
}

export default function AssetsPage() {
  const [groups, setGroups] = useState<AssetGrouped[]>([]);
  const [loading, setLoading] = useState(true);
  const [holdGroupKeys, setHoldGroupKeys] = useState<Set<string>>(new Set());
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [renameModal, setRenameModal] = useState<{ isOpen: boolean; groupKey: string; currentName: string }>({
    isOpen: false,
    groupKey: '',
    currentName: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  useEffect(() => {
    setMounted(true);
    const authRecord = pb.authStore.model;
    setIsAdmin(authRecord?.role?.toLowerCase() === 'admin');
  }, []);

  useEffect(() => {
    // Load assets regardless of auth status
    loadAssets();
  }, [router]);

  async function loadAssets() {
    try {
      const authRecord = pb.authStore.model;
      // Fetch assets without authentication requirement
      // Use paginated request with reasonable limit to reduce server load
      // Use unique requestKey to prevent auto-cancellation
      const records = await pb.collection('assets').getList<AssetRecord>(1, 500, {
        requestKey: 'assets-list-all',
      });
      const grouped: Record<string, AssetGrouped> = {};
      for (const rec of records.items) {
        const descRaw = rec.asset_description ?? '';
        const groupKey = String(rec.group_key ?? descRaw).trim();
        const desc = descRaw || 'Unknown';
        const key = groupKey;
        if (!grouped[key]) {
          grouped[key] = { groupKey, description: desc, total: 0, available: 0, borrowed: 0 };
        }
        // Fill representative image per group (first available)
        if (!grouped[key].imageUrl && rec.image) {
          try {
            grouped[key].imageUrl = pb.files.getUrl(rec as AssetRecord, rec.image);
          } catch {}
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
      
      try {
        // Use paginated request to avoid large getFullList loads
        // Try multiple filter syntaxes as PocketBase relation filters can be sensitive
        try {
          const held = await pb.collection('assets').getList<AssetRecord>(1, 100, {
            filter: `current_holder = "${authRecord.id}"`,
            requestKey: 'assets-held-by-user-1',
          });
          setHoldGroupKeys(new Set(held.items.map((r) => String(r.group_key ?? r.asset_description ?? '').trim())));
        } catch (filterErr: unknown) {
          console.warn("First filter syntax failed, trying alternative...");
          try {
            const held = await pb.collection('assets').getList<AssetRecord>(1, 100, {
              filter: `current_holder.id = "${authRecord.id}"`,
              requestKey: 'assets-held-by-user-2',
            });
            setHoldGroupKeys(new Set(held.items.map((r) => String(r.group_key ?? r.asset_description ?? '').trim())));
          } catch (altErr: unknown) {
            console.warn("Alternative filter failed, falling back to client-side filtering");
            const allRes = await pb.collection('assets').getList<AssetRecord>(1, 500, {
              requestKey: 'assets-held-fallback',
            });
            const held = allRes.items.filter((item) => 
              item.current_holder === authRecord.id || (item.current_holder as any)?.id === authRecord.id
            );
            setHoldGroupKeys(new Set(held.map((r) => String(r.group_key ?? r.asset_description ?? '').trim())));
          }
        }
      } catch (holdErr: unknown) {
        // Log the error but don't fail the entire load
        console.error('Error fetching held assets:', holdErr);
        const holdMsg = holdErr instanceof Error ? holdErr.message : String(holdErr);
        const holdStatus = (holdErr as any)?.status;
        
        if (holdStatus === 400) {
          console.warn('Invalid filter query for current_holder. Check collection schema or field name.');
        }
        
        // Set empty hold keys and continue
        setHoldGroupKeys(new Set());
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const status = (err as any)?.status;
      
      // Treat 404 (collection not found) as empty result
      if (msg.includes('Missing collection context') || status === 404) {
        console.warn('assets collection not found, treating as empty');
        setGroups([]);
        setHoldGroupKeys(new Set());
        return;
      }
      
      // PocketBase JS SDK may autocancel requests in some dev/runtime situations
      // (ClientResponseError 0). Treat autocancelled requests as "no data".
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
      if (!authRecord?.id || !pb.authStore.isValid) {
        alert('请先登录后再借出资产');
        router.push('/auth/login');
        return;
      }

      // 1. Find an available asset in this group to borrow
      const availableAsset = await pb.collection('assets').getFirstListItem<AssetRecord>(
        `(group_key = "${params.groupKey}" || asset_description = "${params.description}") && current_holder = ""`,
        { requestKey: `find-available-asset-${params.groupKey}` }
      );

      if (!availableAsset) {
        alert('没有可借出的资产');
        return;
      }

      // 2. Update the asset to mark it as borrowed by current user
      await pb.collection('assets').update(availableAsset.id, {
        current_holder: authRecord!.id,
      });

      // 3. Create a lend record in the history
      await pb.collection('lend_records').create({
        // Use user id so it works when `lend_records.user` is a relation field.
        // (If the PB collection is configured as text, storing the id is still valid.)
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
          alert('借出成功！柜门已打开');
        } else {
          alert('借出成功！（未连接门控）');
        }
      } catch (doorErr) {
        console.warn('Door open failed:', doorErr);
        alert('借出成功，但门控打开失败。请检查设备连接');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const status = (err as any)?.status;
      const errorData = (err as any)?.data;
      console.error('Borrow error details:', { message: msg, status, data: errorData });
      alert('借出失败: ' + msg);
    }
  }

  async function handleReturn(params: { groupKey: string; description: string }) {
    try {
      const authRecord = pb.authStore.model;
      if (!authRecord?.id || !pb.authStore.isValid) {
        alert('请先登录后再归还资产');
        router.push('/auth/login');
        return;
      }

      // 1. Find the asset currently held by this user
      const heldAsset = await pb.collection('assets').getFirstListItem<AssetRecord>(
        `(group_key = "${params.groupKey}" || asset_description = "${params.description}") && current_holder = "${authRecord.id}"`,
        { requestKey: `find-held-asset-${params.groupKey}` }
      );

      if (!heldAsset) {
        alert('未找到您借出的资产');
        return;
      }

      // 2. Create a return record in the history
      await pb.collection('lend_records').create({
        user: authRecord!.id,
        asset_group_key: params.groupKey,
        asset_description: params.description,
        action: 'return',
      });

      // 3. Update the asset to mark it as available
      await pb.collection('assets').update(heldAsset.id, {
        current_holder: '',
      });

      loadAssets(); // Refresh
      alert('归还成功！');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const status = (err as any)?.status;
      const errorData = (err as any)?.data;
      console.error('Return error details:', { message: msg, status, data: errorData });
      alert('归还失败: ' + msg);
    }
  }

  async function handleRename(groupKey: string, newName: string) {
    try {
      setIsSaving(true);
      // Get all assets in this group
      const records = await pb.collection('assets').getFullList<AssetRecord>({
        filter: `group_key = "${groupKey}"`,
      });

      // Update all records in the group
      for (const record of records) {
        await pb.collection('assets').update(record.id, {
          asset_description: newName,
          asset_name: newName,
          group_key: newName.trim().replace(/\s+/g, ' '),
        });
      }

      // Refresh the assets list
      await loadAssets();
      setRenameModal({ isOpen: false, groupKey: '', currentName: '' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Rename failed:', msg);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-bold text-black dark:text-white">资产总览</h1>
        {mounted && (
          <div className="flex items-center gap-3">
            {isAdmin && (
              <>
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
                <Button
                  variant="primary"
                  size="md"
                  onClick={async () => {
                    try {
                      const { exportAssetsToExcel } = await import("@/lib/export/assetExport");
                      await exportAssetsToExcel();
                    } catch (e) {
                      const msg = e instanceof Error ? e.message : String(e);
                      alert("导出失败：" + msg);
                    }
                  }}
                >
                  导出资产
                </Button>
              </>
            )}
            <div className="flex items-center gap-2 border-l border-gray-300 dark:border-gray-600 pl-3 ml-1">
              <button
                onClick={() => setViewMode('card')}
                className={`p-2 rounded-md transition ${
                  viewMode === 'card'
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
                title="卡片视图"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4z" />
                  <path d="M3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6z" />
                  <path d="M14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition ${
                  viewMode === 'list'
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
                title="列表视图"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <p>加载中...</p>
      ) : viewMode === 'card' ? (
        <div className="grid gap-6 grid-cols-[repeat(auto-fit,minmax(280px,1fr))]">
          {groups.map((group) => (
            <Card key={group.groupKey || group.description} className="p-0 overflow-hidden flex flex-col">
              <CardImage src={group.imageUrl} className="rounded-none rounded-t-[24px]" />
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
                  {isAdmin && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setRenameModal({
                          isOpen: true,
                          groupKey: group.groupKey,
                          currentName: group.description,
                        })
                      }
                      className="ml-auto"
                    >
                      重命名
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <div
              key={group.groupKey || group.description}
              className="bg-white dark:bg-gray-800 rounded-lg p-4 flex items-center justify-between border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center gap-4 flex-1">
                {group.imageUrl && (
                  <img
                    src={group.imageUrl}
                    alt={group.description}
                    className="w-16 h-16 object-cover rounded-md"
                  />
                )}
                <div className="flex-1">
                  <h3 className="text-base font-bold text-black dark:text-white">{group.description}</h3>
                  <div className="flex gap-3 mt-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      <Badge tone="green">可借 {group.available}</Badge>
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      <Badge tone="blue">已借 {group.borrowed}</Badge>
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
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
                {isAdmin && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setRenameModal({
                        isOpen: true,
                        groupKey: group.groupKey,
                        currentName: group.description,
                      })
                    }
                  >
                    重命名
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <RenameAssetModal
        isOpen={renameModal.isOpen}
        currentName={renameModal.currentName}
        onClose={() => setRenameModal({ isOpen: false, groupKey: '', currentName: '' })}
        onSave={(newName) => handleRename(renameModal.groupKey, newName)}
        isSaving={isSaving}
      />
    </AppShell>
  );
}

