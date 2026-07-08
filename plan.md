# HF 农场成品菜收成与库存管理系统 — 实施方案 (v3)

## 背景

本项目旨在将现有基于 AppSheet + Google Sheets 的农场成品菜登记系统，迁移至基于 Next.js + Supabase 的移动优先 Web 应用。

### 核心功能
- **数据录入**：选择产品、团队、箱型、板型、大棚编号，录入 Bag/Loose 数量
- **今日收菜明细**：按团队筛选分组，展示每个团队总数量及各菜名数量
- **指定日期收菜明细**：选定日期后查看同样的分组视图
- **指定日期区域分类**：按棚内区域/外采等分类汇总
- **团队总览饼图**：饼图展示各团队收菜占比及全场总量
- **产品库管理**：维护 280+ 个产品的主数据
- **农场成品菜登记表导出**：按日期导出供用户线下调整的 Excel 表格

### 技术栈
- **前端**: Next.js 16 (App Router) + React 19 + TypeScript
- **样式**: Tailwind CSS v4 + shadcn/ui
- **后端**: Supabase (PostgreSQL + Auth + RLS)
- **图表**: Recharts
- **Excel**: xlsx 库
- **数据获取**: SWR
- **状态管理**: Zustand

### Supabase 项目
- Project: `HF Farm Project`
- ID: `dcafcfiqyfzoqwpmvpyj`
- Region: `ap-southeast-2`
- URL: `https://dcafcfiqyfzoqwpmvpyj.supabase.co`

---

## 已确认事项

| 事项 | 决定 |
|------|------|
| Tailwind CSS 版本 | v4（项目已配置） |
| 认证方案 | Supabase Auth (Email/Password) + user_profiles 角色控制 + RLS |
| 现有 Excel 导入 | 管理员页面上传导入，初始化时 SQL 批量导入产品 |
| 导出 Excel 格式 | 与现有 Excel 格式一致 |

---

## 大棚编号与区域分类规则

### 大棚编号列表

| 大棚编号 | 区域分类 |
|---------|---------|
| `GH01` ~ `GH14` | 棚内区域 |
| `2号棚内AF200` | 棚内区域 |
| `户外WF03` | 户外WF03 区域 |
| `外采` | 外采 |
| `进口` | 进口 |

### 区域分类推导逻辑（SQL Generated Column）

```sql
CASE
  WHEN greenhouse_no = '进口' THEN '进口'
  WHEN greenhouse_no = '外采' THEN '外采'
  WHEN greenhouse_no = '户外WF03' THEN '户外WF03区域'
  WHEN greenhouse_no LIKE 'GH%' OR greenhouse_no = '2号棚内AF200' THEN '棚内区域'
  ELSE '其他'
END
```

---

## 用户账号

| 邮箱 | 角色 |
|------|------|
| `ichsh48@gmail.com` | **admin** |
| `betty.huforwork@gmail.com` | **admin** |
| `vivianshe2011@gmail.com` | editor |
| `hfkaraka2022@gmail.com` | editor |
| `ruiwang1974@gmail.com` | editor |
| `tszfungfan76@gmail.com` | editor |
| `why121257353@gmail.com` | editor |
| `wy380567211@gmail.com` | editor |

- 初始密码：`HFfarm2026`
- 用户可在设置页面修改密码

---

## 核心数据结构

### 枚举值常量

```typescript
// 团队 - 严格禁止手动输入
TEAMS = ['H', 'J', 'M', 'S', 'W', 'Y']

// 箱型 - 严格禁止手动输入
CRATES = ['B21', 'B37', 'B46', 'L20', 'L36', 'L47', 'L60', 'carton', '葡萄框P']

// 板型 - 允许手动输入，预设值
PALLETS = ['NPO', 'RED', 'FCC']

// 大棚编号 - 允许手动输入，预设值
GREENHOUSES = ['GH01'~'GH14', '2号棚内AF200', '户外WF03', '外采', '进口']
```

### 数据库表

#### products — 产品主数据（280+ 条）
- `id` uuid PK
- `product_id` text UNIQUE (P0001...)
- `factory_product_name` text NOT NULL
- `stockcode` text NULLABLE
- `exo_description` text NULLABLE
- `is_active` boolean DEFAULT true

#### harvest_entries — 收菜登记流水（核心表）
- `id` uuid PK
- `entry_date` date NOT NULL DEFAULT CURRENT_DATE
- `product_id` uuid FK → products
- `bag_qty` integer DEFAULT 0
- `loose_qty` integer DEFAULT 0
- `total_qty` integer GENERATED (bag+loose)
- `crate` text NOT NULL
- `pallet` text NOT NULL
- `greenhouse_no` text NOT NULL
- `area_category` text GENERATED (区域分类逻辑)
- `team` text NOT NULL CHECK IN ('H','J','M','S','W','Y')
- `notes` text NULLABLE
- `created_by` uuid FK → auth.users
- `created_by_email` text
- `created_at` timestamptz DEFAULT now()

#### user_profiles — 用户配置
- `id` uuid PK = auth.users.id
- `email` text NOT NULL
- `display_name` text
- `role` text CHECK IN ('admin','editor','viewer') DEFAULT 'editor'
- `created_at` timestamptz

### RLS 策略

| 表 | 操作 | 策略 |
|----|------|------|
| products | SELECT | 所有认证用户 |
| products | INSERT/UPDATE/DELETE | admin |
| harvest_entries | SELECT | 所有认证用户 |
| harvest_entries | INSERT | admin 或 editor |
| harvest_entries | DELETE | admin 或本人当天记录 |
| user_profiles | SELECT 自己 | 所有认证用户 |
| user_profiles | SELECT 全部/UPDATE | admin |

---

## 文件结构

```
hffarm/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx                       # 重定向到 /today
│   ├── login/page.tsx                 # 登录页
│   ├── (dashboard)/
│   │   ├── layout.tsx                 # Dashboard 布局（底部导航）
│   │   ├── today/page.tsx             # 今日收菜明细
│   │   ├── register/page.tsx          # 数据录入
│   │   ├── history/page.tsx           # 指定日期明细
│   │   ├── area/page.tsx              # 区域分类
│   │   ├── chart/page.tsx             # 团队总览图
│   │   ├── products/page.tsx          # 产品库
│   │   ├── export/page.tsx            # 导出登记表
│   │   ├── settings/page.tsx          # 修改密码
│   │   └── admin/
│   │       ├── page.tsx
│   │       ├── import/page.tsx        # Excel 导入
│   │       └── users/page.tsx         # 用户管理
│   └── auth/callback/route.ts
├── components/
│   ├── ui/                            # shadcn/ui 组件
│   ├── layout/
│   │   ├── MobileNav.tsx              # 底部导航栏
│   │   └── Header.tsx
│   ├── forms/
│   │   ├── HarvestForm.tsx
│   │   ├── ProductSearch.tsx
│   │   └── NumberStepper.tsx
│   ├── tables/
│   │   ├── HarvestTable.tsx
│   │   └── AreaSummary.tsx
│   └── charts/
│       └── TeamPieChart.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   ├── constants.ts
│   ├── types.ts
│   ├── utils.ts
│   └── export-excel.ts
├── hooks/
│   ├── useHarvestEntries.ts
│   ├── useProducts.ts
│   └── useUser.ts
├── stores/
│   └── dateFilter.ts
├── middleware.ts
├── plan.md                            # 本文件
└── .env.local
```

---

## 分阶段实施计划

### Phase 1: 基础设施
1. 安装所有依赖
2. 初始化 shadcn/ui
3. 创建 Supabase 数据库表 + 索引 + RLS
4. 导入 280 个产品
5. 创建 8 个用户账号
6. 配置 Supabase 客户端
7. 配置 Next.js Auth 中间件
8. 创建 types.ts、constants.ts

### Phase 2: 认证与布局
9. 登录页
10. Dashboard 布局（Header + 底部导航栏）
11. 修改密码页
12. 更新根布局和首页重定向

### Phase 3: 核心录入功能
13. ProductSearch 模糊搜索
14. NumberStepper 步进器
15. HarvestForm 录入表单
16. Register 录入页（含今日流水 + 删除）

### Phase 4: 数据展示页面
17. 今日收菜明细
18. 指定日期收菜明细
19. 指定日期区域分类
20. 团队总览饼图
21. SWR Hooks + Zustand store

### Phase 5: 高级功能
22. 产品库管理
23. Excel 导出（明细 + 农场成品菜登记表）
24. Excel 导入
25. 用户管理页
26. 导入现有 391 条历史数据

---

## 农场成品菜登记表导出格式

Excel 列结构：
`Item | Stockcode | EXO Description | Factory Product Name | 上日库存(0) | 当日产量 | 单价 | 棚号 | 出货1(=产量) | 出货2 | 当日库存(公式) | Pallet | 备注`

按三区域分页/分段：
1. 大棚收菜入库（棚内区域）
2. outdoor收菜入库（户外WF03区域）
3. 外采菜加工入库（外采）

  下载后提醒用户自行调整库存和出货数据。

---

## 阶段性更新与重要修复 (v3)

1. **核心录入交互优化 (`/register`)**：
   - **大棚输入**：移除默认的 `GH01`，初始状态留空，防止误输入。
   - **箱数/散装数量步进器**：由原有两个步进器合并为单个步进器 + 「Bag (包数) / Loose (散数)」二选一高亮切换按钮，简化手机操作。
   - **板型选择**：从下拉选择重构为大尺寸的按钮网格 (NPO / RED / FCC)，一键点选。
   - **今日已录入列表**：默认状态折叠，点击按钮展开。单条记录末尾增加 `HH:mm` 录入时间戳，方便对账。

2. **数据库种子数据重载**：
   - 清空了 `harvest_entries` 表中旧的测试数据。
   - 从 `HF_Farm_Daily_Register.xlsx` 的 `Register` 表单中清洗并提取了 **418** 条真实历史收菜流水，通过 SQL 脚本 `supabase_seed_harvest_v2.sql` 全量导入，保留了真实的用户关联、产品外键关联和历史录入时间。

3. **管理员导出全量历史数据**：
   - 在 `lib/export-excel.ts` 中新增了 `exportAllHistory` 导出全量流水函数。
   - 在 `app/(dashboard)/export/page.tsx` 中使用 `useUser()` 进行了角色校验，对管理员 (Admin) 专门显示「导出全部历史数据」的蓝色模块，允许一键下载包含“序号、日期、区域分类、大棚编号、团队、产品 ID、产品名称、EXO 编码、EXO 描述、Bag、Loose、总数、箱型、板型、备注、录入人、录入时间”的完整流水 Excel 文件。

4. **关键 Bug 修复**：
   - **DropdownMenu 崩溃**：修复了 Base UI 下拉菜单点击头像导致 MenuGroupContext 丢失崩溃的错误，使用标准的 HTML 标签替代不兼容的 DropdownMenuLabel。
   - **Supabase Auth 登录失败**：补齐了手工插入用户的 `auth.identities` 表关联，并将 `auth.users` 的 `confirmation_token` 等字段默认为空字符串而非 `NULL`，彻底解决了 Go 语言 Scan 错误导致登录接口返回 500 的底层缺陷。
