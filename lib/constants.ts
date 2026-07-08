// Enum constants for the HF Farm application
// These mirror the CHECK constraints in the database

export const TEAMS = ['H', 'J', 'M', 'S', 'W', 'Y'] as const
export type Team = (typeof TEAMS)[number]

// Crates: STRICT - no free-form input allowed
export const CRATES = ['B21', 'B37', 'B46', 'L20', 'L36', 'L47', 'L60', 'carton', '葡萄框P'] as const
export type Crate = (typeof CRATES)[number]

// Pallets: allow free-form + presets
export const PALLETS = ['NPO', 'RED', 'FCC'] as const
export type Pallet = string

// Greenhouses: allow free-form + presets
export const GREENHOUSES = [
  'GH01', 'GH02', 'GH03', 'GH04', 'GH05', 'GH06', 'GH07',
  'GH08', 'GH09', 'GH10', 'GH11', 'GH12', 'GH13', 'GH14',
  '2号棚内AF200', '户外WF03', '外采', '进口',
] as const
export type Greenhouse = string

export const ROLES = ['admin', 'editor', 'viewer'] as const
export type Role = (typeof ROLES)[number]

export const AREA_CATEGORIES = ['棚内区域', '户外WF03区域', '外采', '进口', '其他'] as const

// Team colors for charts
export const TEAM_COLORS: Record<string, string> = {
  H: '#3b82f6', // blue
  J: '#eab308', // yellow
  M: '#22c55e', // green
  S: '#ef4444', // red
  W: '#f97316', // orange
  Y: '#06b6d4', // cyan
}

// Area category labels for display
export const AREA_LABELS: Record<string, string> = {
  '棚内区域': '🏠 棚内区域',
  '户外WF03区域': '🌿 户外WF03区域',
  '外采': '🚛 外采',
  '进口': '✈️ 进口',
  '其他': '❓ 其他',
}
