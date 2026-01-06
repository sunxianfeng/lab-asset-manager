'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { pb } from '@/lib/pocketbase';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

export default function SettingsPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();
  const authRecord = pb.authStore.model;

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/auth/login');
    }
  }, [router]);

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (newPassword !== confirmPassword) {
      setError('密码不匹配');
      return;
    }
    setLoading(true);
    try {
      await pb.collection('users').update(authRecord!.id, {
        password: newPassword,
        passwordConfirm: newPassword,
      });
      setSuccess('密码更新成功');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '密码更新失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <h1 className="text-4xl font-bold text-zinc-900 mb-8">设置</h1>

      <Card className="max-w-xl px-10 py-8">
        <h2 className="text-2xl font-semibold text-zinc-900 mb-6">修改密码</h2>
        <form onSubmit={handlePasswordChange} className="flex flex-col gap-4">
          <Input
            type="password"
            placeholder="新密码"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="确认密码"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          {success && <p className="text-green-600 text-sm">{success}</p>}
          <Button type="submit" disabled={loading} className="mt-2">
            {loading ? '更新中...' : '更新密码'}
          </Button>
        </form>
      </Card>
    </AppShell>
  );
}

