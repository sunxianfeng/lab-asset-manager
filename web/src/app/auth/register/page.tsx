'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { pb } from '@/lib/pocketbase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

type PocketBaseError = {
  status?: number;
  message?: string;
  data?: {
    message?: string;
    data?: Record<string, { message?: string }>;
  };
};

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const normalizedEmail = email.trim().toLowerCase();

    // Validate passwords match
    if (password !== passwordConfirm) {
      setError('两次输入的密码不一致');
      return;
    }

    // Validate password length
    if (password.length < 8) {
      setError('密码长度至少需要8个字符');
      return;
    }

    setLoading(true);
    try {
      // Create the user
      await pb.collection('users').create({
        username,
        email: normalizedEmail,
        password,
        passwordConfirm,
        role: 'user',
        emailVisibility: true,
      });

      // Automatically log in after registration
      // Use the email as the identity for authentication (PocketBase default)
      await pb.collection('users').authWithPassword(normalizedEmail, password);
      
      // Redirect to assets page
      router.push('/assets');
    } catch (err: unknown) {
      const pbErr = err as PocketBaseError;
      const fieldErrors = pbErr?.data?.data;
      const firstFieldMessage = fieldErrors
        ? Object.values(fieldErrors).find((v) => v?.message)?.message
        : undefined;

      setError(
        firstFieldMessage ||
          pbErr?.data?.message ||
          pbErr?.message ||
          '注册失败，请检查输入信息'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <Card className="w-full max-w-md px-12 py-10">
        <h1 className="text-center text-3xl font-semibold text-zinc-900 mb-8">注册账户</h1>
        <form onSubmit={handleRegister} className="flex flex-col gap-4">
          <Input
            type="text"
            placeholder="用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
          />
          <Input
            type="email"
            placeholder="邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="密码（至少8个字符）"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
          <Input
            type="password"
            placeholder="确认密码"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            required
            minLength={8}
          />
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <Button type="submit" disabled={loading} className="mt-2">
            {loading ? '注册中...' : '注册'}
          </Button>
        </form>
        <div className="mt-6 text-center text-sm text-zinc-600">
          已有账户？{' '}
          <Link href="/auth/login" className="text-(--accent) hover:underline font-semibold">
            立即登录
          </Link>
        </div>
      </Card>
    </div>
  );
}

