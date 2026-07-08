'use client'

import { usePathname } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { MobileNav } from '@/components/layout/MobileNav'
import type { UserProfile } from '@/lib/types'

const PAGE_TITLES: Record<string, string> = {
  '/today':        '今日收菜明细',
  '/register':     '录入收菜数据',
  '/history':      '历史收菜明细',
  '/area':         '区域分类情况',
  '/chart':        '团队总览图',
  '/products':     '产品库',
  '/export':       '导出登记表',
  '/settings':     '个人设置',
  '/admin':        '管理后台',
  '/admin/import': '导入数据',
  '/admin/users':  '用户管理',
}

export default function DashboardShell({
  children,
  profile,
  isAdmin,
}: {
  children: React.ReactNode
  profile: UserProfile | null
  isAdmin: boolean
}) {
  const pathname = usePathname()
  const title = PAGE_TITLES[pathname] ?? 'HF 农场'

  return (
    <>
      <Header title={title} profile={profile} />
      <main className="farm-page overflow-y-auto bg-gray-50/50">
        <div className="max-w-2xl mx-auto px-4 py-4">
          {children}
        </div>
      </main>
      <MobileNav isAdmin={isAdmin} />
    </>
  )
}
