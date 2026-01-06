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
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await pb.collection('users').update(authRecord!.id, {
        password: newPassword,
        passwordConfirm: newPassword,
      });
      setSuccess('Password updated successfully');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <h1 className="text-4xl font-bold mb-8">Settings</h1>

      <Card className="max-w-xl px-10 py-8">
        <h2 className="text-2xl font-semibold mb-6">Change Password</h2>
        <form onSubmit={handlePasswordChange} className="flex flex-col gap-4">
          <Input
            type="password"
            placeholder="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          {success && <p className="text-green-600 text-sm">{success}</p>}
          <Button type="submit" disabled={loading} className="mt-2">
            {loading ? 'Updating...' : 'Update Password'}
          </Button>
        </form>
      </Card>
    </AppShell>
  );
}

