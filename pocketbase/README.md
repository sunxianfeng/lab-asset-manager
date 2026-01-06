# PocketBase

本目录用于管理 PocketBase 的 **schema 迁移** 与 **服务端 hooks**（无独立后端场景下的原子借还与权限补强）。

## 目录说明

- `pb_migrations/`：PocketBase JS migrations（collections/fields/rules/indexes）。
- `pb_hooks/`：PocketBase hooks（借出/归还原子逻辑、禁止普通用户提权等）。

## 约定

- `users`：auth collection，包含自定义字段 `role`（`admin`/`user`）。
- `assets`：**unit-level** 记录（Excel 每行一件），前端按 `group_key` 聚合展示数量。
- `asset_imports`：导入文件留存（excel/csv）。
- `lend_records`：借还流水（后续 hooks 会在 create 时选择/更新具体的 `asset_unit`）。


