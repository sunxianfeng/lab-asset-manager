import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import Link from "next/link";

export default function Home() {
  return (
    <AppShell
      title="资产管理"
      actions={
        <>
          <Button variant="secondary">登录</Button>
          <Link
            href="/assets/import"
            className="inline-flex h-11 items-center justify-center rounded-[14px] bg-[var(--accent)] px-4 text-[15px] font-semibold tracking-tight text-white transition hover:brightness-95 active:brightness-90"
          >
            资产导入
          </Link>
        </>
      }
    >
      <section className="space-y-5 sm:space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              资产总览
            </h1>
            <p className="mt-2 text-sm text-[var(--app-muted)]">
              以条目（聚合）展示，条目内包含可借数量与借还入口。
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="min-w-0">
                  <CardTitle className="truncate">资产条目示例 {i + 1}</CardTitle>
                  <CardDescription className="mt-1 truncate">
                    Category · Location · Manufacturer
                  </CardDescription>
                </div>
                <Badge tone={i % 3 === 0 ? "green" : "blue"}>
                  {i % 3 === 0 ? "Available" : "Limited"}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-[var(--app-muted)]">
                    可借{" "}
                    <span className="font-semibold text-[var(--app-fg)]">3</span>{" "}
                    / 总数{" "}
                    <span className="font-semibold text-[var(--app-fg)]">7</span>
                  </div>
                  <Button size="sm">借出</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
