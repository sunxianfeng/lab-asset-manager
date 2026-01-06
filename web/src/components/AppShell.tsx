import Link from "next/link";
import { cn } from "@/lib/cn";

export function AppShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-h-screen bg-zinc-50", className)}>
      <nav className="glass-strong px-5 py-4 sm:px-6 mb-8">
        <div className="flex items-center justify-between gap-4">
          <Link href="/assets" className="text-lg font-extrabold tracking-tight">
            Asset Manager
          </Link>
          <div className="flex gap-4 text-sm">
            <Link href="/assets" className="hover:underline">Assets</Link>
            <Link href="/records" className="hover:underline">Records</Link>
            <Link href="/settings" className="hover:underline">Settings</Link>
          </div>
        </div>
      </nav>

      <main className="px-5 sm:px-6 max-w-7xl mx-auto">{children}</main>

      <footer className="py-6 text-center text-xs text-[var(--app-muted)]">
        Powered by Next.js + PocketBase
      </footer>
    </div>
  );
}


