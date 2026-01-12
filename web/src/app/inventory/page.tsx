'use client';

import { AppShell } from '@/components/AppShell';

export default function InventoryPage() {
  return (
    <AppShell title="资产盘点">
      <div className="bg-white/60 backdrop-blur-[20px] rounded-3xl p-6">
        <p>资产盘点页面内容</p>
        {/* 这里可以添加资产盘点的具体功能 */}
      </div>
    </AppShell>
  );
}