import Link from "next/link";
import { cn } from "@/lib/cn";

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
  return (
    <div className={cn("min-h-screen bg-zinc-50 dark:bg-zinc-900", className)}>
      <nav className="glass-strong px-5 py-4 sm:px-6 mb-8">
        <div className="flex items-center justify-between gap-4">
          <Link href="/assets" className="text-lg font-extrabold tracking-tight text-black dark:text-white">
            资产管理系统
          </Link>
          <div className="flex gap-4 text-sm font-medium text-zinc-700 dark:text-zinc-200">
            <Link href="/assets" className="hover:text-black dark:hover:text-white transition-colors">资产</Link>
            <Link href="/records" className="hover:text-black dark:hover:text-white transition-colors">记录</Link>
            <Link href="/settings" className="hover:text-black dark:hover:text-white transition-colors">设置</Link>
          </div>
        </div>
      </nav>

      <main className="px-5 sm:px-6 max-w-7xl mx-auto">
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


