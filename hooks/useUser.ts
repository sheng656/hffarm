'use client'

import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import type { UserProfile } from '@/lib/types'

const supabase = createClient()

async function fetchUser(): Promise<{ user: { id: string; email?: string } | null; profile: UserProfile | null }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, profile: null }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return { user, profile: profile as UserProfile | null }
}

export function useUser() {
  const { data, error, isLoading } = useSWR('current-user', fetchUser, {
    revalidateOnFocus: false,
    refreshInterval: 0,
  })

  return {
    user: data?.user ?? null,
    profile: data?.profile ?? null,
    role: data?.profile?.role ?? null,
    isAdmin: data?.profile?.role === 'admin' || data?.profile?.role === 'superadmin',
    isSuperAdmin: data?.profile?.role === 'superadmin',
    isEditor: data?.profile?.role === 'admin' || data?.profile?.role === 'superadmin' || data?.profile?.role === 'editor',
    isLoading,
    error,
  }
}
