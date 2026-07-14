import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { MobileNav } from '@/components/layout/MobileNav'
import type { UserProfile } from '@/lib/types'

// Page title map
const PAGE_TITLES: Record<string, string> = {
  '/today':          '今日收菜明细',
  '/register':       '录入收菜数据',
  '/history':        '历史收菜明细',
  '/stats':          '板数筐数统计',
  '/area':           '区域分类情况',
  '/chart':          '团队总览图',
  '/products':       '产品库',
  '/export':         '导出登记表',
  '/settings':       '个人设置',
  '/admin':          '管理后台',
  '/admin/import':   '导入数据',
  '/admin/users':    '用户管理',
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // Verify auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch user profile for role & display name
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const role = (profile as UserProfile | null)?.role
  const isAdmin = role === 'admin' || role === 'superadmin'

  return (
    <div className="flex flex-col h-full">
      {/* Header renders on client so it can read pathname — use a wrapper */}
      <DashboardShell profile={profile as UserProfile | null} isAdmin={isAdmin}>
        {children}
      </DashboardShell>
    </div>
  )
}

// Client wrapper needed because Header uses usePathname
import DashboardShell from './DashboardShell'
