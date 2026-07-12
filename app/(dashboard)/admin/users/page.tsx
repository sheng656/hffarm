'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, ShieldAlert, Crown, Lock } from 'lucide-react'
import { toast } from 'sonner'
import type { UserProfile } from '@/lib/types'

const supabase = createClient()

export default function UsersPage() {
  const { profile, isAdmin, isLoading: loadingUser } = useUser()
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isAdmin) {
      fetchProfiles()
    }
  }, [isAdmin])

  async function fetchProfiles() {
    setLoading(true)
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('role', { ascending: true })
      .order('email', { ascending: true })

    if (error) {
      toast.error('加载用户列表失败: ' + error.message)
    } else {
      setProfiles(data as UserProfile[])
    }
    setLoading(false)
  }

  async function handleRoleChange(profileId: string, newRole: 'admin' | 'editor' | 'viewer', email: string) {
    if (profileId === profile?.id) {
      toast.warning('你无法修改自己的角色')
      return
    }

    const targetProfile = profiles.find(p => p.id === profileId)
    if (targetProfile?.role === 'superadmin') {
      toast.error('超级管理员权限不可修改')
      return
    }

    if (targetProfile?.role === 'admin' && profile?.role !== 'superadmin') {
      toast.warning('只有超级管理员才能修改管理员的权限')
      return
    }

    const { error } = await supabase
      .from('user_profiles')
      .update({ role: newRole })
      .eq('id', profileId)

    if (error) {
      toast.error('修改失败: ' + error.message)
    } else {
      toast.success(`已更新 ${email} 的角色为 ${newRole}`)
      setProfiles(prev =>
        prev.map(p => (p.id === profileId ? { ...p, role: newRole } : p))
      )
    }
  }

  if (loadingUser) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-green-600" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-3">
        <ShieldAlert className="w-12 h-12 text-amber-500" />
        <h2 className="font-semibold text-lg text-gray-800">无管理权限</h2>
        <p className="text-gray-500 text-sm">该页面仅对农场管理员开放</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="shadow-sm border-gray-100">
        <CardHeader>
          <CardTitle className="text-base">用户权限管理</CardTitle>
          <CardDescription>管理员可以更改农场员工的系统使用权限。</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
            </div>
          ) : (
            <div className="border border-gray-100 rounded-xl overflow-hidden bg-white">
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead>邮箱</TableHead>
                    <TableHead>名字</TableHead>
                    <TableHead className="w-32">权限角色</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium text-gray-900 text-sm truncate max-w-[180px]">
                        {p.email}
                      </TableCell>
                      <TableCell className="text-gray-600 text-sm">{p.display_name ?? '—'}</TableCell>
                       <TableCell>
                        {p.role === 'superadmin' ? (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-semibold w-fit border border-indigo-100">
                            <Crown className="w-3.5 h-3.5" />
                            超级管理员
                          </div>
                        ) : p.role === 'admin' && profile?.role !== 'superadmin' ? (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-semibold w-fit border border-amber-100">
                            <Lock className="w-3.5 h-3.5" />
                            管理员
                          </div>
                        ) : (
                          <Select
                            disabled={p.id === profile?.id}
                            defaultValue={p.role}
                            onValueChange={(val) => handleRoleChange(p.id, val as any, p.email)}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">管理员 (Admin)</SelectItem>
                              <SelectItem value="editor">编辑员 (Editor)</SelectItem>
                              <SelectItem value="viewer">查看员 (Viewer)</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
