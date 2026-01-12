'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { pb } from '@/lib/pocketbase';

interface Asset {
  id: string;
  asset_description?: string;
  group_key?: string;
}

export default function MaintenancePage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [formData, setFormData] = useState({
    assetId: '',
    date: '',
    description: '',
    notes: '',
  });

  useEffect(() => {
    const loadAssets = async () => {
      try {
        const records = await pb.collection('assets').getFullList<Asset>();
        setAssets(records ?? []);
      } catch (error) {
        // PocketBase js-sdk may autocancel requests (ClientResponseError 0).
        // Treat autocancel or empty-list conditions as an empty assets list
        // so the UI doesn't show an error when there are simply no records or
        // the request was cancelled by the SDK for navigation changes.
        const msg = (error as any)?.message || String(error);
        const isAutoCancelled = msg.includes('autocancelled') || (error as any)?.code === 0;
        if (isAutoCancelled) {
          console.info('PocketBase request autocancelled; using empty assets list.');
          setAssets([]);
        } else {
          console.error('Failed to load assets:', error);
        }
      }
    };
    loadAssets();
  }, []);

  const handleSave = () => {
    // Mock save
    console.log('Saving maintenance record:', formData);
    alert('Maintenance record saved (mock)');
    setIsModalOpen(false);
    setFormData({ assetId: '', date: '', description: '', notes: '' });
  };

  const actions = (
    <Button onClick={() => setIsModalOpen(true)} className="px-4 py-2">
      +
    </Button>
  );

  return (
    <AppShell title="维修与计量" actions={actions}>
      <div className="bg-white/60 backdrop-blur-[20px] rounded-3xl p-6">
        <p>维修与计量页面内容</p>
        {/* 这里可以添加维修与计量的具体功能 */}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">添加维修与计量记录</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">选择资产</label>
                <select
                  value={formData.assetId}
                  onChange={(e) => setFormData({ ...formData, assetId: e.target.value })}
                  className="w-full h-11 rounded-[14px] px-4 bg-white/70 dark:bg-white/10 border border-[var(--app-border)]"
                >
                  <option value="">请选择资产</option>
                  {assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.asset_description || asset.group_key || asset.id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">日期</label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">描述</label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="维修描述"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">备注</label>
                <Input
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="额外备注"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button onClick={() => setIsModalOpen(false)} variant="secondary">
                取消
              </Button>
              <Button onClick={handleSave}>
                保存
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}