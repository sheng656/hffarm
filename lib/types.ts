// All shared TypeScript types for the HF Farm app

export type UserRole = 'superadmin' | 'admin' | 'editor' | 'viewer'

export interface UserProfile {
  id: string
  email: string
  display_name: string | null
  role: UserRole
  created_at: string
}

export interface Product {
  id: string
  product_id: string
  factory_product_name: string
  stockcode: string | null
  exo_description: string | null
  is_active: boolean
  created_at: string
}

export type AreaCategory = '棚内区域' | '户外WF03区域' | '外采' | '进口' | '其他'

export interface HarvestEntry {
  id: string
  entry_date: string
  product_id: string
  bag_qty: number
  loose_qty: number
  total_qty: number
  crate: string
  pallet: string
  pallet_id: string | null
  greenhouse_no: string
  area_category: AreaCategory
  team: string
  notes: string | null
  created_by: string | null
  created_by_email: string | null
  created_at: string
}

export interface HarvestEntryWithProduct extends HarvestEntry {
  product: Product
}

export interface PalletRecord {
  id: string
  entry_date: string
  pallet_type: string
  created_by: string | null
  created_by_email: string | null
  created_at: string
}

export interface PalletWithEntries extends PalletRecord {
  entries: HarvestEntryWithProduct[]
}

// Form input type for creating a harvest entry
export interface HarvestEntryInput {
  entry_date: string
  product_id: string
  bag_qty: number
  loose_qty: number
  crate: string
  pallet: string
  greenhouse_no: string
  team: string
  notes?: string
}

// Aggregated team summary used in pivot/chart views
export interface TeamSummary {
  team: string
  total: number
  products: ProductSummary[]
}

export interface ProductSummary {
  product_name: string
  product_id: string
  total: number
  entries: HarvestEntryWithProduct[]
}

export interface AreaSummary {
  area_category: AreaCategory
  total: number
}
