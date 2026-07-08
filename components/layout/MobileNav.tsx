'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ClipboardList,
  PlusCircle,
  CalendarDays,
  MapPin,
  MoreHorizontal,
  BarChart2,
  Package,
  FileDown,
  Settings,
  Shield,
  FileUp,
  Users,
} from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
}

const mainNavItems: NavItem[] = [
  { href: '/today',    label: '今日',  icon: ClipboardList },
  { href: '/register', label: '录入',  icon: PlusCircle },
  { href: '/history',  label: '历史',  icon: CalendarDays },
  { href: '/area',     label: '区域',  icon: MapPin },
]

const moreItems: NavItem[] = [
  { href: '/chart',    label: '团队图表', icon: BarChart2 },
  { href: '/export',   label: '导出登记表', icon: FileDown },
  { href: '/products', label: '产品库',  icon: Package },
  { href: '/settings', label: '个人设置', icon: Settings },
]

const adminItems: NavItem[] = [
  { href: '/admin/import', label: '导入数据', icon: FileUp },
  { href: '/admin/users',  label: '用户管理', icon: Users },
]

interface MobileNavProps {
  isAdmin?: boolean
}

export function MobileNav({ isAdmin = false }: MobileNavProps) {
  const pathname = usePathname()

  return (
    <nav className="farm-nav bg-white/95 backdrop-blur-md border-t border-gray-100 shadow-[0_-1px_20px_rgba(0,0,0,0.06)]">
      <div className="flex items-stretch h-full max-w-lg mx-auto">
        {mainNavItems.map(item => {
          const active = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-all duration-150',
                active
                  ? 'text-green-600'
                  : 'text-gray-400 hover:text-gray-700 active:scale-95',
              )}
            >
              <Icon
                className={cn(
                  'w-5 h-5 transition-transform duration-150',
                  active && 'scale-110',
                  item.href === '/register' && !active && 'w-6 h-6 text-green-500',
                  item.href === '/register' && active && 'w-6 h-6',
                )}
                strokeWidth={active ? 2.5 : 1.8}
              />
              <span>{item.label}</span>
              {active && (
                <span className="absolute bottom-[calc(env(safe-area-inset-bottom)+0px)] w-1 h-1 rounded-full bg-green-600 mt-0.5" />
              )}
            </Link>
          )
        })}

        {/* More Sheet */}
        <Sheet>
          <SheetTrigger asChild>
            <button className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-gray-400 hover:text-gray-700 active:scale-95 transition-all duration-150">
              <MoreHorizontal className="w-5 h-5" strokeWidth={1.8} />
              <span>更多</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl pb-safe max-h-[70dvh]">
            <SheetHeader className="pb-4">
              <SheetTitle className="text-left text-base">更多功能</SheetTitle>
            </SheetHeader>
            <div className="space-y-1">
              {moreItems.map(item => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-3.5 rounded-xl text-sm font-medium transition-colors',
                      pathname === item.href
                        ? 'bg-green-50 text-green-700'
                        : 'text-gray-700 hover:bg-gray-50 active:bg-gray-100',
                    )}
                  >
                    <Icon className="w-5 h-5 text-green-600 flex-shrink-0" />
                    {item.label}
                  </Link>
                )
              })}

              {isAdmin && (
                <>
                  <div className="flex items-center gap-2 px-3 py-2 mt-2">
                    <Shield className="w-3 h-3 text-amber-500" />
                    <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">管理员功能</span>
                  </div>
                  {adminItems.map(item => {
                    const Icon = item.icon
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 px-3 py-3.5 rounded-xl text-sm font-medium transition-colors',
                          pathname === item.href
                            ? 'bg-amber-50 text-amber-700'
                            : 'text-gray-700 hover:bg-gray-50 active:bg-gray-100',
                        )}
                      >
                        <Icon className="w-5 h-5 text-amber-600 flex-shrink-0" />
                        {item.label}
                      </Link>
                    )
                  })}
                </>
              )}
            </div>
            <div className="pb-[env(safe-area-inset-bottom,16px)]" />
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  )
}
