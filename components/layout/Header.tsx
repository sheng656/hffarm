'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { LogOut, Settings, Leaf } from 'lucide-react'
import Link from 'next/link'
import type { UserProfile } from '@/lib/types'

interface HeaderProps {
  title: string
  profile: UserProfile | null
  rightAction?: React.ReactNode
}

export function Header({ title, profile, rightAction }: HeaderProps) {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = profile?.display_name
    ? profile.display_name.slice(0, 2).toUpperCase()
    : profile?.email?.slice(0, 2).toUpperCase() ?? '??'

  return (
    <header className="farm-header bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-[0_1px_20px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between h-full px-4 max-w-2xl mx-auto">
        {/* Logo + Title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-green-600 flex items-center justify-center">
            <Leaf className="w-4 h-4 text-white" />
          </div>
          <h1 className="font-semibold text-gray-900 text-base truncate">{title}</h1>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {rightAction}

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button className="focus:outline-none active:scale-95 transition-transform">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-green-100 text-green-700 text-xs font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </button>
              }
            />
            <DropdownMenuContent align="end" className="w-52">
              <div className="px-3 py-2 text-xs font-normal text-muted-foreground">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium leading-none text-gray-900">{profile?.display_name ?? '—'}</p>
                  <p className="text-xs text-muted-foreground leading-none">{profile?.email}</p>
                  {profile?.role === 'admin' && (
                    <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide mt-0.5">管理员</span>
                  )}
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                render={
                  <Link href="/settings" className="cursor-pointer">
                    <Settings className="w-4 h-4 mr-2" />
                    修改密码
                  </Link>
                }
              />
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer"
              >
                <LogOut className="w-4 h-4 mr-2" />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
