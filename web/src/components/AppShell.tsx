'use client';

import { useEffect, useState, useRef } from 'react';
import Link from "next/link";
import { cn } from "@/lib/cn";
import { pb } from "@/lib/pocketbase";

export function AppShell({
  children,
  className,
  title,
  actions,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  actions?: React.ReactNode;
}) {
  const [username, setUsername] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const authRecord = pb.authStore.model;
    setUsername(authRecord?.username || authRecord?.email || '');
    setUserRole(authRecord?.role || '');
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu]);

  const handleLogout = () => {
    pb.authStore.clear();
    window.location.href = '/auth/login';
  };

  const getRoleDisplay = (role: string) => {
    return role === 'admin' ? '管理员' : '普通用户';
  };

  return (
    <div className={cn("min-h-screen bg-zinc-50 dark:bg-zinc-900", className)}>
      <nav className="glass-strong px-5 py-4 sm:px-6 mb-8">
        <div className="flex items-center justify-between gap-4">
          <Link href="/assets" className="text-lg font-extrabold tracking-tight text-black dark:text-white">
            资产管理系统
          </Link>
          <div className="flex gap-4 text-sm font-medium text-zinc-700 dark:text-zinc-200">
            <Link href="/assets" className="hover:text-black dark:hover:text-white transition-colors">资产</Link>
            <Link href="/records" className="hover:text-black dark:hover:text-white transition-colors">借阅记录</Link>
            <Link href="/settings" className="hover:text-black dark:hover:text-white transition-colors">设置</Link>
          </div>
          {username && (
            <div className="relative ml-auto" ref={userMenuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
              >
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {username} ({getRoleDisplay(userRole)})
                </span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </button>
              {showUserMenu && (
                <div 
                  className="absolute right-0 mt-2 w-48 bg-white dark:bg-zinc-800 rounded-lg shadow-lg z-50"
                  onMouseLeave={() => setShowUserMenu(false)}
                >
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg"
                  >
                    退出登录
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </nav>

      <main className="px-5 sm:px-6 max-w-screen-2xl mx-auto">
        {(title || actions) && (
          <div className="flex items-center justify-between mb-6">
            {title ? (
              <h1 className="text-4xl font-bold text-black dark:text-white">{title}</h1>
            ) : null}
            {actions ? <div>{actions}</div> : null}
          </div>
        )}

        {children}
      </main>

      <footer className="py-6 text-center text-xs text-[var(--app-muted)]">
        Powered by Next.js + PocketBase
      </footer>
    </div>
  );
}


