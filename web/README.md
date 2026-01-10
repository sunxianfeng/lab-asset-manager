# Lab Asset Manager

实验室资产管理系统 - 基于 Next.js + PocketBase 构建的现代化资产借还管理平台。

## 功能特性

- 📦 资产管理：浏览、导入、导出实验室资产
- 🔄 借还记录：完整的借出/归还流程跟踪
- 👥 用户权限：普通用户和管理员角色分离
- 🖼️ 图片支持：从 Excel 自动提取并上传资产图片
- 🚪 硬件集成：支持串口控制柜门开关（可选）

## 快速开始

### 1. 安装依赖

```bash
cd web
npm install
```

### 2. 启动 PocketBase

在 macOS 上启动 PocketBase（选择一种方式）：

```bash
# 方式1：使用 Homebrew（推荐）
brew install pocketbase
pocketbase serve --dir ./pb_data

# 方式2：下载官方二进制
# 从 https://github.com/pocketbase/pocketbase/releases 下载对应版本
chmod +x ./pocketbase
./pocketbase serve --dir ./pb_data
```

首次启动会打开 http://127.0.0.1:8090/_/ 创建管理员账户。

### 3. 初始化数据库

运行脚本自动创建所需的 collections：

```bash
export PB_ADMIN_EMAIL=你的管理员邮箱
export PB_ADMIN_PASSWORD=你的管理员密码
node scripts/init-pocketbase-collections.js
```

**重要：** 脚本完成后，需要手动在 PocketBase 管理界面为 `users` collection 添加 `role` 字段：
1. 打开 http://127.0.0.1:8090/_/
2. Collections → users → 添加字段
3. Name: `role`，Type: `Select`，Values: `user,admin`
4. 为你的账户设置 role 为 `admin`

### 4. 配置环境变量（可选）

创建 `.env.local` 文件：

```env
NEXT_PUBLIC_PB_URL=http://127.0.0.1:8090
PB_URL=http://127.0.0.1:8090
PB_ADMIN_EMAIL=你的管理员邮箱
PB_ADMIN_PASSWORD=你的管理员密码
```

### 5. 启动开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 即可使用。

## 一键启动（推荐）

项目根目录提供了快速启动脚本：

```bash
# 在项目根目录执行
./start.sh
```

这个脚本会自动：
- ✅ 检查依赖（Node.js, PocketBase）
- ✅ 安装 npm 包（如果需要）
- ✅ 启动 PocketBase（后台）
- ✅ 启动 Next.js 开发服务器

停止所有服务：

```bash
./stop.sh
```

## 项目结构

```
lab-asset-manager/
├── web/                      # Next.js 前端应用
│   ├── src/
│   │   ├── app/             # 页面路由
│   │   │   ├── assets/      # 资产管理
│   │   │   ├── records/     # 借还记录
│   │   │   ├── auth/        # 登录注册
│   │   │   └── api/         # API 路由
│   │   ├── components/      # React 组件
│   │   ├── lib/            # 工具函数
│   │   └── types/          # TypeScript 类型
│   └── scripts/            # 初始化和工具脚本
├── pb_data/                 # PocketBase 数据目录
├── start.sh                # 一键启动脚本
├── stop.sh                 # 停止脚本
└── SETUP_GUIDE.md          # 完整部署指南
```

## 使用说明

### 导入资产

1. 以管理员身份登录
2. 进入「资产总览」页面
3. 点击「导入资产」按钮
4. 上传 Excel 文件（支持嵌入图片自动提取）
5. 系统会自动解析并创建资产记录

### 借出/归还资产

1. 在「资产总览」页面浏览资产
2. 点击「借出」按钮借出可用资产
3. 点击「归还」按钮归还已借出的资产
4. 在「借还记录」页面查看历史记录

### 导出资产

1. 以管理员身份登录
2. 在「资产总览」页面点击「导出资产」
3. 系统会生成包含所有资产信息的 Excel 文件

## 常见问题

详见 [SETUP_GUIDE.md](../SETUP_GUIDE.md#常见问题)

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
