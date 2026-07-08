'use client'

import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import type { Product } from '@/lib/types'

const supabase = createClient()

async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('factory_product_name')

  if (error) throw error
  return data ?? []
}

export function useProducts() {
  return useSWR<Product[]>('products', fetchProducts, {
    // Products rarely change — cache for 10 minutes
    refreshInterval: 10 * 60 * 1000,
    revalidateOnFocus: false,
  })
}
