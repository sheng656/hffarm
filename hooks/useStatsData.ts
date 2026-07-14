'use client'

import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { PALLETS, CRATES } from '@/lib/constants'
import type { HarvestEntry } from '@/lib/types'

const supabase = createClient()

export interface PalletStat {
  pallet_type: string
  new_count: number
  old_count: number
  total: number
}

export interface CrateStat {
  crate: string
  total_qty: number
}

interface StatsOptions {
  date?: string
  startDate?: string
  endDate?: string
}

async function fetchStats(opts: StatsOptions) {
  let query = supabase
    .from('harvest_entries')
    .select('id, entry_date, pallet, pallet_id, crate, total_qty')

  if (opts.date) {
    query = query.eq('entry_date', opts.date)
  } else if (opts.startDate && opts.endDate) {
    query = query.gte('entry_date', opts.startDate).lte('entry_date', opts.endDate)
  }

  const { data: entries, error } = await query
  if (error) throw error

  const rows = (entries ?? []) as Pick<HarvestEntry, 'id' | 'entry_date' | 'pallet' | 'pallet_id' | 'crate' | 'total_qty'>[]

  // Check if there is any old data (pallet_id is null)
  const hasOldData = rows.some(r => r.pallet_id === null)

  // Calculate Pallet statistics
  // 1. New data: group by pallet_id and get the pallet type
  const newPalletMap = new Map<string, string>() // pallet_id -> pallet_type
  rows.forEach(r => {
    if (r.pallet_id) {
      newPalletMap.set(r.pallet_id, r.pallet || '未知')
    }
  })

  // Count new pallets by type
  const newCounts: Record<string, number> = {}
  newPalletMap.forEach((palletType) => {
    newCounts[palletType] = (newCounts[palletType] || 0) + 1
  })

  // 2. Old data: group by pallet field (each row = 1 pallet)
  const oldCounts: Record<string, number> = {}
  rows.forEach(r => {
    if (r.pallet_id === null) {
      const type = r.pallet || '未分类'
      oldCounts[type] = (oldCounts[type] || 0) + 1
    }
  })

  // Combine all distinct pallet types from constants + actual data
  const allPalletTypes = Array.from(new Set([
    ...PALLETS,
    ...Object.keys(newCounts),
    ...Object.keys(oldCounts),
  ])).sort()

  const palletStats: PalletStat[] = allPalletTypes.map(type => {
    const new_count = newCounts[type] || 0
    const old_count = oldCounts[type] || 0
    return {
      pallet_type: type,
      new_count,
      old_count,
      total: new_count + old_count,
    }
  }).filter(stat => stat.total > 0) // only include used types

  // Calculate Crate statistics (sum total_qty per crate type)
  const crateTotals: Record<string, number> = {}
  rows.forEach(r => {
    const crateName = r.crate || '未知'
    crateTotals[crateName] = (crateTotals[crateName] || 0) + (r.total_qty || 0)
  })

  const allCrates = Array.from(new Set([
    ...CRATES,
    ...Object.keys(crateTotals),
  ])).sort()

  const crateStats: CrateStat[] = allCrates.map(crate => ({
    crate,
    total_qty: crateTotals[crate] || 0,
  })).filter(stat => stat.total_qty > 0)
    .sort((a, b) => b.total_qty - a.total_qty)

  const totalPallets = palletStats.reduce((sum, item) => sum + item.total, 0)
  const totalCrates = rows.reduce((sum, item) => sum + (item.total_qty || 0), 0)

  return {
    palletStats,
    crateStats,
    totalPallets,
    totalCrates,
    hasOldData,
    rowsCount: rows.length,
  }
}

export function useStatsData(opts: StatsOptions) {
  const key = opts.date
    ? `stats:${opts.date}`
    : `stats:${opts.startDate}_to_${opts.endDate}`

  const { data, isLoading, error } = useSWR(
    opts.date || (opts.startDate && opts.endDate) ? key : null,
    () => fetchStats(opts),
    { refreshInterval: 30_000 }
  )

  return {
    palletStats: data?.palletStats ?? [],
    crateStats: data?.crateStats ?? [],
    totalPallets: data?.totalPallets ?? 0,
    totalCrates: data?.totalCrates ?? 0,
    hasOldData: data?.hasOldData ?? false,
    rowsCount: data?.rowsCount ?? 0,
    isLoading,
    error,
  }
}
