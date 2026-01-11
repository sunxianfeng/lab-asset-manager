# 集合字段详细清单

下面列出项目中四个重要集合（tables）及其字段详情，包含字段名、类型、是否必填和 options（如适用）。可参考 `MANUAL_FIELDS_GUIDE.md` 的格式。

说明：
- 内置 users 集合 id 为 `_pb_users_auth_`，在 relation 字段中使用。
- 本文档基于 `/web/scripts/init-pocketbase-collections.js` 中的定义。

---

## 1) assets 集合
集合用途：存放资产信息。

字段列表（按脚本定义顺序）：

- `group_key`
  - 类型: text
  - Required: 否
  - Options: {}

- `asset_description`
  - 类型: text
  - Required: 否
  - Options: {}

- `asset_name`
  - 类型: text
  - Required: 否
  - Options: {}

- `serial_no`
  - 类型: text
  - Required: 否
  - Options: {}

- `category`
  - 类型: text
  - Required: 否
  - Options: {}

- `location`
  - 类型: text
  - Required: 否
  - Options: {}

- `excel_user`
  - 类型: text
  - Required: 否
  - Options: {}

- `manufacturer`
  - 类型: text
  - Required: 否
  - Options: {}

- `value_cny`
  - 类型: number
  - Required: 否
  - Options: {}

- `commissioning_time`
  - 类型: date
  - Required: 否
  - Options: {}

- `metrology_validity_period`
  - 类型: date
  - Required: 否
  - Options: {}

- `metrology_requirement`
  - 类型: text
  - Required: 否
  - Options: {}

- `metrology_cost`
  - 类型: number
  - Required: 否
  - Options: {}

- `remarks`
  - 类型: text
  - Required: 否
  - Options: {}

- `status`
  - 类型: select (单选)
  - Required: 否
  - Options:
    - maxSelect: 1
    - values: ["available", "borrowed"]

- `is_fixed_assets`
  - 类型: bool
  - Required: 否
  - Options: {}

- `current_holder`
  - 类型: relation (单选)
  - Required: 否
  - Options:
    - collectionId: `_pb_users_auth_` (users 集合)
    - maxSelect: 1
    - cascadeDelete: false

- `image`
  - 类型: file
  - Required: 否
  - Options:
    - maxSelect: 1
    - maxSize: 5242880 (5 MB)
    - mimeTypes: ["image/jpeg","image/png","image/gif","image/webp"]
    - thumbs: ["100x100","300x300"]

- `import_ref`
  - 类型: relation (单选)
  - Required: 否
  - Options:
    - collectionId: `asset_imports`
    - maxSelect: 1
    - cascadeDelete: false

Notes:
- `id` 是 PocketBase 系统字段，会自动存在；不要在 schema 中创建与之冲突的字段名 `id`。

---

## 2) lend_records 集合
集合用途：记录借还操作（借出 / 归还）。

字段列表：

- `user`
  - 类型: relation (单选)
  - Required: 是
  - Options:
    - collectionId: `_pb_users_auth_`
    - maxSelect: 1
    - cascadeDelete: false

- `asset_group_key`
  - 类型: text
  - Required: 否
  - Options: {}

- `asset_description`
  - 类型: text
  - Required: 否
  - Options: {}

- `action`
  - 类型: select (单选)
  - Required: 是
  - Options:
    - maxSelect: 1
    - values: ["lend", "return"]

---

## 3) asset_imports 集合
集合用途：存放导入批次 / 源文件信息。

字段列表：

- `source_file`
  - 类型: file
  - Required: 否
  - Options:
    - maxSelect: 1
    - maxSize: 52428800 (50 MB)
    - mimeTypes: []

- `created_by`
  - 类型: text
  - Required: 否
  - Options: {}

- `notes`
  - 类型: text
  - Required: 否
  - Options: {}

---

## 4) users 集合（内置）
集合 id: `_pb_users_auth_`

说明：这是 PocketBase 的内置认证用户集合。脚本中的 relation 字段都引用此集合。常见字段（由 PocketBase 管理）：

- `id` (系统)
- `created` / `updated` (系统时间戳)
- `email` (authentication related)
- `emailVisibility`
- `username` (可选，视 PocketBase 配置)
- `verified` (boolean)
- `avatar` (file)

注意：不要尝试创建与系统保留字段冲突的自定义字段名（例如 `id`）。如需在用户上存额外属性，可通过 admin UI 或 API 添加自定义字段。

---

如果您希望我把这份文档放到仓库中的特定位置（例如 `/docs/`），或希望我把文档内容同步到 README 中的某处，请告诉我路径，我会替您添加。
