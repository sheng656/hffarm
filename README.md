# 🌿 HF 农场成品菜数字化管理系统

> **一站式农产品收成登记、统计分析与报表导出解决方案**
> 
> 专为新西兰 HF 农场量身打造，替代传统手工 Excel 登记流程，
> 让收成数据录入、对账、分类汇总和 Excel 导出在手机上一步完成。

---

## 🎯 系统解决的核心问题

| 过去（手工 Excel） | 现在（HF 农场系统） |
|:---|:---|
| 📋 纸质记录再手工录入 Excel，效率低、易出错 | 📱 手机现场扫码录入，实时同步 |
| 🔢 每天手动统计板数、筐数、各产品数量 | 📊 自动按团队/区域/产品实时汇总 |
| 📊 手动制作日报表、周报表、Excel 汇总 | 📤 一键导出标准格式 Excel，支持单日/周报 |
| 🔐 所有人共用一个 Excel 文件，无权限管控 | 🔑 精细权限控制（超管/管理/编辑/查看） |
| ❌ 无法追溯谁录入、何时录入 | ✅ 每条记录自动记录操作人和时间戳 |
| ⏱️ 打板和登记分开操作，无法关联 | 🧩 按板（Pallet）录入，自动关联物理板和产品 |

---

## 📸 系统功能概览

### 📋 今日收成看板 — 一览全局

实时展示当日总产量、使用板数、使用筐数，并按团队（H/J/M/S/W/Y）分类统计。

![今日收成看板](docs/screenshots/today_page.png)

**核心指标一目了然：**
- **总产量**：所有团队今日累计总收成
- **使用板数**：今日实际使用的物理板（Pallet）数量（自动兼容新旧录入模式）
- **使用筐数**：今日总包装筐数（= 总数量）
- 点击板数/筐数卡片可查看**板型与箱型统计明细**

---

### ➕ 板级数据录入 — 贴合实际打板流程

系统独创的**按板录入**模式，与产线实际操作流程完全一致：先选板→再往板上添加产品。

![板级录入界面](docs/screenshots/register_page.png)

**操作步骤：**
1. 选择板型（NPO / RED / FCC）
2. 在板上逐一添加产品：选产品→选团队→选箱型→选大棚→输数量
3. 一板完成后，一键「确认提交整板」

---

### 📊 板数筐数统计明细 — 精细统计分析

点击今日/历史页面的板数或筐数卡片，进入统计明细页面。

![板型统计页面](docs/screenshots/stats_pallet_page.png)

**板型统计 Tab：** 展示每种板型（NPO、RED、FCC）的使用数量，自动区分新版整板录入与旧版单条录入数据。

![箱型统计页面](docs/screenshots/stats_crate_page.png)

**箱型统计 Tab：** 展示每种箱型（L47、B37、L60、carton 等）的总筐数及占比，附可视化进度条。

支持**导出当日 Excel** 和**导出一周 (近7天) Excel** 统计报表。

---

### 📅 历史数据查询 — 灵活对账

选择任意日期查看当日的收成详情，支持按团队筛选和按产品折叠浏览。

![历史数据页面](docs/screenshots/history_page.png)

---

### 🏠 区域分类汇总 — 大棚/户外/外采一目了然

按区域自动分类汇总收成数据，支持导出**单日区域汇总表**和**周度区域汇总表**。

![区域分类页面](docs/screenshots/area_page.png)

---

### 📈 团队总览图 — 可视化团队产出

用饼图直观展示各采收团队的产出占比，帮助管理者评估团队效率。

![团队总览图](docs/screenshots/chart_page.png)

---

### 📤 报表导出中心 — 一键生成标准 Excel

支持多种格式的 Excel 导出，完全兼容原有报表格式：

![导出中心](docs/screenshots/export_page.png)

- **农场成品菜登记表** — 与旧版 Excel 模板格式一致
- **全量历史数据导出** — 管理员专用，包含所有字段的完整备份
- **区域分类汇总表** — 单日/周度
- **板数筐数统计表** — 单日/一周

---

## 🔑 权限与安全管控

系统采用四级角色权限体系，配合数据库层面的行级安全策略（RLS），确保数据安全：

| 角色 | 录入数据 | 查看/导出 | 编辑他人记录 | 管理用户 | 数据导入/清理 |
| :--- | :---: | :---: | :---: | :---: | :---: |
| 👑 **超级管理员** | ✅ | ✅ | ✅ | ✅ | ✅ |
| 🛡️ **管理员** | ✅ | ✅ | ✅ | ✅ (有限) | ✅ |
| ✏️ **编辑员** | ✅ | ✅ | ❌ 仅自己当天 | ❌ | ❌ |
| 👁️ **查看员** | ❌ | ✅ | ❌ | ❌ | ❌ |

**安全特性：**
- 数据库行级安全策略（RLS）防止越权操作
- 管理员互保机制：普通管理员无法修改其他管理员权限
- 每条操作自动记录操作人邮箱和时间戳，支持审计追溯

---

## 🛠 技术架构

| 层级 | 技术栈 |
|:---|:---|
| **前端框架** | Next.js 16 (App Router) + React 19 + TypeScript |
| **样式系统** | Tailwind CSS v4 + shadcn/ui + Base UI |
| **数据库** | Supabase (PostgreSQL + PostgREST + Auth + RLS) |
| **状态管理** | Zustand（日期过滤同步） |
| **数据获取** | SWR（30秒自动轮询，实时看板） |
| **报表生成** | xlsx-js-style（自定义样式 Excel 输出） |
| **时区处理** | 内置 Auckland/NZ 时区转换，确保跨时区数据一致性 |

---

## 📂 项目结构

```
hffarm/
├── app/
│   ├── layout.tsx                 # 根布局 & 时区设置 (Auckland)
│   ├── page.tsx                   # 根重定向至 /today
│   ├── login/page.tsx             # Supabase 登录页
│   ├── (dashboard)/
│   │   ├── today/page.tsx         # 今日收成看板
│   │   ├── register/page.tsx      # 板级录入界面
│   │   ├── history/page.tsx       # 历史数据查询
│   │   ├── stats/page.tsx         # 板数筐数统计明细 (NEW)
│   │   ├── area/page.tsx          # 区域分类汇总
│   │   ├── chart/page.tsx         # 团队总览图
│   │   ├── export/page.tsx        # 报表导出中心
│   │   ├── products/page.tsx      # 产品目录
│   │   ├── settings/page.tsx      # 个人设置
│   │   └── admin/                 # 管理后台
│   │       ├── import/page.tsx    # 数据导入与清理
│   │       └── users/page.tsx     # 用户权限管理
├── components/                    # UI 组件
├── hooks/                         # 数据查询 Hooks
│   ├── useHarvestEntries.ts       # 收成记录查询
│   ├── useStatsData.ts            # 板数筐数统计 (NEW)
│   ├── useProducts.ts             # 产品目录查询
│   └── useUser.ts                 # 用户角色查询
├── lib/
│   ├── auckland-time.ts           # NZ 时区转换
│   ├── constants.ts               # 枚举常量
│   ├── export-excel.ts            # Excel 生成引擎
│   └── types.ts                   # TypeScript 类型定义
└── docs/screenshots/              # 系统截图
```

---

## 🗄 数据库架构

### 核心数据表

#### `harvest_entries` — 收成明细表
每一条记录代表一次产品收成登记（产品 + 数量 + 箱型 + 板型 + 大棚 + 团队）。

#### `pallets` — 板记录表
代表一块物理板（Pallet），多条 `harvest_entries` 通过 `pallet_id` 关联到同一块板。

#### `products` — 产品目录表
280+ 种产品的主数据表，包含工厂产品名称、EXO 编码等。

#### `user_profiles` — 用户权限表
与 Supabase Auth 同步，记录用户角色和权限。

---

## 🚀 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量（.env.local）
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...

# 3. 启动开发服务器
npm run dev
```

---

## 📈 未来路线图

- [ ] 库存管理：对接出货数据，自动计算当日库存
- [ ] 移动端扫码：支持扫描条形码快速录入产品
- [ ] 自动化报告：定时推送日报/周报至邮箱
- [ ] 数据看板：更丰富的图表和趋势分析

---

## 📞 技术支持

若系统使用中遇到异常，请联系系统管理员。
