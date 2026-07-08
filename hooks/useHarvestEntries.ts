'use client'

import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import type { HarvestEntryWithProduct } from '@/lib/types'

const supabase = createClient()

interface FetchOptions {
  date: string
  team?: string
  areaCategory?: string
}

function getKey(opts: FetchOptions) {
  return `harvest:${opts.date}:${opts.team ?? 'all'}:${opts.areaCategory ?? 'all'}`
}

async function fetchEntries(opts: FetchOptions): Promise<HarvestEntryWithProduct[]> {
  let query = supabase
    .from('harvest_entries')
    .select(`
      *,
      product:products(*)
    `)
    .eq('entry_date', opts.date)
    .order('created_at', { ascending: false })

  if (opts.team && opts.team !== 'all') {
    query = query.eq('team', opts.team)
  }
  if (opts.areaCategory && opts.areaCategory !== 'all') {
    query = query.eq('area_category', opts.areaCategory)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as HarvestEntryWithProduct[]
}

export function useHarvestEntries(opts: FetchOptions) {
  return useSWR<HarvestEntryWithProduct[]>(
    getKey(opts),
    () => fetchEntries(opts),
    { refreshInterval: 30_000 } // poll every 30s for live updates
  )
}
