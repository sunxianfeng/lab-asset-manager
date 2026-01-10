"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { pb } from "@/lib/pocketbase";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardImage,
} from "@/components/ui/Card";

interface AssetGrouped {
  groupKey: string;
  description: string;
  total: number;
  available: number;
  borrowed: number;
}

export default function Home() {
  const router = useRouter();
  const authRecord = pb.authStore.model;
  const isAuthed = pb.authStore.isValid;

  const [groups, setGroups] = useState<AssetGrouped[]>([]);
  const [loading, setLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [holdGroupKeys, setHoldGroupKeys] = useState<Set<string>>(new Set());

  const actions = useMemo(
    () => (
      <div className="flex items-center gap-3">
        <Link
          href="/auth/login"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] px-4 text-[15px] font-semibold tracking-tight transition select-none bg-white/70 text-[var(--app-fg)] hover:bg-white/80 active:bg-white/70 border border-[var(--app-border)]"
        >
          登录
        </Link>
        <Link
          href="/assets/import"
          className="inline-flex h-11 items-center justify-center rounded-[14px] bg-[var(--accent)] px-4 text-[15px] font-semibold tracking-tight text-white transition hover:brightness-95 active:brightness-90"
        >
          资产导入
        </Link>
        <Button variant="secondary" type="button">
          资产导出
        </Button>
      </div>
    ),
    [],
  );

  useEffect(() => {
    // mark that we are client-side to avoid hydration mismatches
    setIsClient(true);

    if (!pb.authStore.isValid) {
      setGroups([]);
      setHoldGroupKeys(new Set());
      setLoading(false);
      return;
    }

    loadAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed]);

  async function loadAssets() {
    setLoading(true);
    try {
      // Use paginated request with reasonable limit to reduce server load
      const result = await pb.collection("assets").getList(1, 500);
      const records = result.items;
      const grouped: Record<string, AssetGrouped> = {};

      for (const rec of records as any[]) {
        const groupKey = String(rec?.group_key ?? "");
        const description = String(rec?.asset_description ?? "Unknown");
        const key = groupKey || description;

        if (!grouped[key]) {
          grouped[key] = { groupKey, description, total: 0, available: 0, borrowed: 0 };
        }

        grouped[key].total++;
        if (rec?.current_holder) {
          grouped[key].borrowed++;
        } else {
          grouped[key].available++;
        }
      }

      setGroups(Object.values(grouped));

      try {
        if (pb.authStore.isValid && authRecord?.id) {
          // use paginated request to avoid large getFullList loads and reduce server pressure
          const res = await pb.collection("assets").getList(1, 100, {
            filter: `current_holder = "${authRecord.id}"`,
          });
          const held = res.items ?? [];
          setHoldGroupKeys(new Set((held as any[]).map((r) => String(r?.group_key ?? ""))));
        }
      } catch (err: unknown) {
        // log full error for debugging
        console.error("Error fetching held assets (full):", err);
        try {
          console.error("Serialized error:", JSON.stringify(err, Object.getOwnPropertyNames(err)));
        } catch {}

        const msg = err instanceof Error ? err.message : String(err);
        console.error("Error fetching held assets:", msg);
        if ((err as any)?.status === 400) {
          console.warn("Invalid request. Please check the filter query or collection schema.");
        } else if ((err as any)?.status >= 500) {
          console.warn("Server error when fetching held assets. Check PocketBase server logs.");
        } else {
          console.error("Unexpected error:", err);
        }

        setHoldGroupKeys(new Set());
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('autocancel') || msg.includes('ClientResponseError') || msg.includes('request was autocancelled')) {
        console.warn('assets.getFullList autocancelled, treating as empty list');
        setGroups([]);
        setHoldGroupKeys(new Set());
        return;
      }
      console.error(err);
      setGroups([]);
      setHoldGroupKeys(new Set());
    } finally {
      setLoading(false);
    }
  }

  async function handleBorrow(params: { description: string; groupKey: string }) {
    if (!pb.authStore.isValid) {
      router.push("/auth/login");
      return;
    }

    try {
      await pb.collection("lend_records").create({
        user: authRecord!.id,
        asset_group_key: params.groupKey,
        asset_description: params.description,
        action: "lend",
      });
      await loadAssets();
    } catch (err: unknown) {
      alert("Borrow failed: " + (err instanceof Error ? err.message : ""));
    }
  }

  async function handleReturn(params: { description: string; groupKey: string }) {
    if (!pb.authStore.isValid) {
      router.push("/auth/login");
      return;
    }

    try {
      await pb.collection("lend_records").create({
        user: authRecord!.id,
        asset_group_key: params.groupKey,
        asset_description: params.description,
        action: "return",
      });
      await loadAssets();
    } catch (err: unknown) {
      alert("Return failed: " + (err instanceof Error ? err.message : ""));
    }
  }

  return (
    <AppShell title="资产管理" actions={actions}>
      <section className="space-y-5 sm:space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl text-[var(--app-fg)]">
              资产总览
            </h1>
            <p className="mt-2 text-sm text-[var(--app-muted)]">
              以条目（聚合）展示，条目内包含可借数量与借还入口。
            </p>
          </div>
        </div>

        {!isClient ? (
          // During SSR/hydration render a neutral placeholder so client and server match
          <p className="text-sm text-[var(--app-muted)]">加载中...</p>
        ) : !pb.authStore.isValid ? (
          <p className="text-sm text-[var(--app-muted)]">请先登录查看资产。</p>
        ) : loading ? (
          <p className="text-sm text-[var(--app-muted)]">加载中...</p>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((group) => {
              const canBorrow = group.available > 0;
              const canReturn = pb.authStore.isValid && group.groupKey && holdGroupKeys.has(group.groupKey);

              return (
                <Card key={group.groupKey || group.description}>
                  <CardImage />
                  <CardHeader>
                    <div className="min-w-0">
                      <CardTitle className="truncate">{group.description}</CardTitle>
                      <CardDescription className="mt-1 truncate">
                        可借 {group.available} · 已借 {group.borrowed}
                      </CardDescription>
                    </div>
                    <Badge tone={group.available > 0 ? "green" : "blue"}>
                      {group.available > 0 ? "Available" : "Limited"}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm text-[var(--app-muted)]">
                        可借{" "}
                        <span className="font-semibold text-[var(--app-fg)]">{group.available}</span>{" "}
                        / 总数{" "}
                        <span className="font-semibold text-[var(--app-fg)]">{group.total}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          disabled={!canBorrow}
                          onClick={() => handleBorrow({ description: group.description, groupKey: group.groupKey })}
                        >
                          借出
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!canReturn}
                          onClick={() => handleReturn({ description: group.description, groupKey: group.groupKey })}
                        >
                          归还
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}
