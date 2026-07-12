# 🌿 HF Farm Produce Management System — Technical Documentation

This repository contains the Next.js and Supabase codebase for the HF Farm Produce and Harvest Management System. It replaced the legacy AppSheet + Google Sheets system, optimizing mobile entry speed, reporting accuracy, and secure administrative controls.

---

## 🛠 Tech Stack

- **Frontend**: Next.js 16 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS v4 + shadcn/ui + Base UI
- **Database**: Supabase (PostgreSQL 15 + PostgREST + Auth + Row Level Security)
- **State Management**: Zustand (for date filtering sync)
- **Data Fetching**: SWR (configured with 30s automatic polling for live dashboard updates)
- **Excel Generation**: `xlsx-js-style` (custom styling for Excel output matching the legacy spreadsheets)

---

## 📂 Project Structure

```
hffarm/
├── app/
│   ├── layout.tsx                 # Root layout & timezone setup (Auckland)
│   ├── page.tsx                   # Root redirection to /today
│   ├── login/page.tsx             # Supabase OTP / password login
│   ├── (dashboard)/
│   │   ├── layout.tsx             # Dashboard wrapper with client/server boundary
│   │   ├── DashboardShell.tsx     # Shell navigation components
│   │   ├── today/page.tsx         # Today's harvest summaries & stats grid
│   │   ├── register/page.tsx      # Board-level (pallet) mobile entry interface
│   │   ├── history/page.tsx       # Date-filtered lookup & summaries
│   │   ├── area/page.tsx          # Section-wise aggregation and export buttons
│   │   ├── chart/page.tsx         # Recharts distribution charts
│   │   ├── products/page.tsx      # Active products catalogue
│   │   ├── export/page.tsx        # Daily register sheet spreadsheet generator
│   │   ├── settings/page.tsx      # User profile and password resets
│   │   └── admin/
│   │       ├── import/page.tsx    # Excel parser, duplicate filter, clear data tools
│   │       └── users/page.tsx     # Superadmin role assignment control panel
├── components/
│   ├── forms/
│   │   ├── EditEntryModal.tsx     # Shared dialog component for updating records
│   │   ├── NumberStepper.tsx      # Custom touch-optimized step counter
│   │   └── ProductSearch.tsx      # Combobox fuzzy product list searcher
│   └── ui/                        # Custom Tailwind/shadcn components
├── hooks/
│   ├── useHarvestEntries.ts       # SWR data fetching hook
│   ├── useProducts.ts             # Cacheable products catalog SWR hook
│   └── useUser.ts                 # Role-checking user context hook
├── lib/
│   ├── auckland-time.ts           # Safely handles New Zealand/Auckland timezone conversions
│   ├── constants.ts               # Enumerated variables (TEAMS, CRATES, PALLETS)
│   ├── export-excel.ts            # XLSX worksheets layouts and cell styles exports
│   └── types.ts                   # Unified TypeScript definitions
```

---

## 🗄 Database Architecture & Schema

### Tables

#### 1. `user_profiles`
Maintains user permissions synced via Supabase Auth triggers.
- `id` (uuid, PK) -> Matches `auth.users.id`
- `email` (text, Not Null)
- `display_name` (text)
- `role` (text, default 'editor') -> Checked by constraint: `role IN ('superadmin', 'admin', 'editor', 'viewer')`
- `created_at` (timestamptz, default now())

#### 2. `products`
The master catalogue containing product descriptions.
- `id` (uuid, PK)
- `product_id` (text, Unique) -> E.g., `P0001`
- `factory_product_name` (text, Not Null)
- `stockcode` (text)
- `exo_description` (text)
- `is_active` (boolean, default true)

#### 3. `pallets` (Board Entity)
Represents a physical pallet carrying crates of harvest items.
- `id` (uuid, PK)
- `entry_date` (date, default current_date)
- `pallet_type` (text, Not Null) -> E.g., `NPO`, `RED`, `FCC`
- `created_by` (uuid, FK -> `auth.users`)
- `created_by_email` (text)
- `created_at` (timestamptz, default now())

#### 4. `harvest_entries` (Details Row)
The transactional log matching products, teams, crates, and quantity on a specific date.
- `id` (uuid, PK)
- `entry_date` (date, Not Null)
- `product_id` (uuid, FK -> `products.id`)
- `bag_qty` (int, default 0)
- `loose_qty` (int, default 0)
- `total_qty` (int, generated: `bag_qty + loose_qty`)
- `crate` (text, Not Null)
- `pallet` (text, Not Null) -> Matches the string name of the pallet type
- `pallet_id` (uuid, FK -> `pallets.id`, NULLABLE) -> Links detail rows to their parent board. Nullable for backward compatibility.
- `greenhouse_no` (text, Not Null)
- `area_category` (text, generated column) -> Derived from `greenhouse_no` to auto-classify area type ('棚内区域', '户外WF03区域', '外采', '进口', '其他')
- `team` (text, Not Null) -> Checked: `team IN ('H','J','M','S','W','Y')`
- `notes` (text)
- `created_by` (uuid, FK -> `auth.users`)
- `created_by_email` (text)
- `created_at` (timestamptz)

---

## 🔒 Security & Admin Controls

### Role Hierarchy
1. **superadmin**: Superuser (Betty). Can manage all users including promoting/demoting `admin` roles.
2. **admin**: System managers. Can edit/delete any harvest record, import/wipe excel logs, and modify editor/viewer user roles. Cannot modify other `admin` or `superadmin` profiles.
3. **editor**: General staff. Can record harvests, view dashboards, and edit/delete their *own* entries for the *current day only*.
4. **viewer**: Auditors/Viewers. Read-only access to dashboards and excel exports.

### Row Level Security (RLS)

#### `harvest_entries`
- **SELECT**: All authenticated users.
- **INSERT**: `admin`, `superadmin`, or `editor` users.
- **UPDATE**: `admin`, `superadmin`, or the creator of the record on the current date.
- **DELETE**: `admin`, `superadmin`, or the creator of the record on the current date.

#### `pallets`
- **SELECT**: All authenticated users.
- **INSERT/UPDATE/DELETE**: Inherits similar constraints to `harvest_entries` checking `get_my_role()`.

### 🛡️ Admin Protection Database Triggers
To prevent privilege escalation and protect managers from unauthorized modifications, a PostgreSQL trigger `prevent_admin_demotion` runs on the `user_profiles` table:
- Only a `superadmin` can modify the role of an `admin` or `superadmin`.
- Nobody (including themselves) can demote or alter the `superadmin` role.
- Standard updates cannot promote a user to `superadmin`.

---

## 🚀 Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Configure environment variables**:
   Create a `.env.local` file with:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```
3. **Run the dev server**:
   ```bash
   npm run dev
   ```

---

## 📈 Database Migration Code
For reference, database schema migrations, seed scripts, and policies are located in `supabase_seed_harvest_v2.sql` and the database updates documented in `implementation_plan.md`.
