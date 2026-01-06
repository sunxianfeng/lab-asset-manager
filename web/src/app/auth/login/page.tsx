'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { pb } from '@/lib/pocketbase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await pb.collection('users').authWithPassword(username, password);
      router.push('/assets');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <Card className="w-full max-w-md px-12 py-10">
        <h1 className="text-center text-3xl font-semibold text-zinc-900 mb-8">登录</h1>
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <Input
            type="text"
            placeholder="用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <Button type="submit" disabled={loading} className="mt-2">
            {loading ? '登录中...' : '登录'}
          </Button>
        </form>
        <div className="mt-6 text-center text-sm text-zinc-600">
          还没有账户？{' '}
          <Link href="/auth/register" className="text-[var(--accent)] hover:underline font-semibold">
            立即注册
          </Link>
        </div>
      </Card>
    </div>
  );
}

