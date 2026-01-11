"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { pb } from "@/lib/pocketbase";
import { parseAssetFile, rowsToAssetUnits } from "@/lib/import/assetImport";

type ImportState =
  | { state: "idle" }
  | { state: "parsing"; filename: string }
  | { state: "uploading"; filename: string }
  | { state: "importing"; total: number; done: number }
  | { state: "done"; total: number }
  | { state: "error"; message: string };

export default function AssetImportPage() {
  const [file, setFile] = React.useState<File | null>(null);
  const [status, setStatus] = React.useState<ImportState>({ state: "idle" });
  const router = useRouter();

  React.useEffect(() => {
    if (status.state === "done") {
      const t = setTimeout(() => {
        router.replace("/assets");
      }, 500);
      return () => clearTimeout(t);
    }
  }, [status, router]);

  async function onImport() {
    if (!file) return;
    if (!pb.authStore.isValid) {
      setStatus({ state: "error", message: "请先登录（需要 admin 权限）。" });
      return;
    }

    function errorMessage(e: unknown) {
      if (e instanceof Error) return e.message;
      return String(e);
    }

    try {
      setStatus({ state: "parsing", filename: file.name });
      const rows = await parseAssetFile(file);
      const units = rowsToAssetUnits(rows);
      console.log("Parsed asset units:", units);
      if (!units.length) {
        setStatus({ state: "error", message: "未解析到有效行，请检查表头与内容。" });
        return;
      }

      setStatus({ state: "uploading", filename: file.name });
      const form = new FormData();
      form.append("source_file", file);
      form.append("created_by", pb.authStore.model?.id ?? "");

      setStatus({ state: "importing", total: units.length, done: 0 });
      const res = await fetch("/api/import-xlsx", {
        method: "POST",
        body: form,
        headers: {
          // Optional: pass current PB token for future auth checks
          Authorization: pb.authStore.token ? `Bearer ${pb.authStore.token}` : "",
        },
      });
      const json = (await res.json()) as unknown;
      const ok = typeof json === "object" && json !== null && "ok" in json && (json as { ok?: unknown }).ok === true;
      if (!res.ok || !ok) {
        const err =
          typeof json === "object" && json !== null && "error" in json ? String((json as { error?: unknown }).error ?? "") : "";
        throw new Error(err || "导入失败（服务器端）。");
      }

      setStatus({ state: "done", total: units.length });
    } catch (e: unknown) {
      setStatus({
        state: "error",
        message: errorMessage(e) || "导入失败，请查看控制台/网络请求。",
      });
    }
  }

  const hint =
    status.state === "idle"
      ? "支持 .csv / .xls / .xlsx。请确保表头字段与模板一致。"
      : status.state === "parsing"
        ? `正在解析：${status.filename}`
        : status.state === "uploading"
          ? `正在上传导入文件：${status.filename}`
          : status.state === "importing"
            ? `正在写入 assets：${status.done} / ${status.total}`
            : status.state === "done"
              ? `导入完成：共 ${status.total} 行（unit）。`
              : status.state === "error"
                ? status.message
                : "";

  return (
    <AppShell title="资产导入">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <div>
              <CardTitle>导入 Excel / CSV</CardTitle>
              <CardDescription className="mt-1">
                仅 admin 可用。系统会保存导入文件，并把每一行写入为一个资产 unit。
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-semibold tracking-tight">文件</div>
              <input
                id="file-input"
                className="hidden"
                type="file"
                accept=".csv,.xls,.xlsx"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <label htmlFor="file-input" className="block">
                <Button
                  type="button"
                  onClick={() => document.getElementById("file-input")?.click()}
                  className="w-full"
                >
                  {file ? `已选择: ${file.name}` : "选择文件"}
                </Button>
              </label>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-[var(--app-muted)]">{hint}</div>
              <Button
                onClick={onImport}
                disabled={!file || status.state === "parsing" || status.state === "uploading" || status.state === "importing"}
              >
                开始导入
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>表头要求</CardTitle>
            <CardDescription className="mt-1">导入会按以下列名映射字段。</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-[var(--app-muted)]">
              {[
                "Is Fixed Assets",
                "Category",
                "Asset description",
                "Serial No",
                "location",
                "user",
                "Manufacturer",
                "Value (CNY)",
                "Commissioning Time",
                "Metrology Validity Period",
                "Metrology Requirement",
                "Metrology Cost",
                "Remarks",
                "Image URL",
              ].map((h) => (
                <li key={h} className="flex items-center justify-between gap-3">
                  <span className="truncate">{h}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}


