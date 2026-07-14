'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, ShieldAlert, Crown, Lock, UserPlus, KeyRound, Pencil, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import type { UserProfile, UserRole } from '@/lib/types'

const supabase = createClient()

export default function UsersPage() {
  const { profile, isAdmin, isSuperAdmin, isLoading: loadingUser } = useUser()
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)

  // Add User Modal State
  const [showAddModal, setShowAddModal] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newDisplayName, setNewDisplayName] = useState('')
  const [newRole, setNewRole] = useState<UserRole>('editor')
  const [adding, setAdding] = useState(false)

  // Reset Password State
  const [resettingId, setResettingId] = useState<string | null>(null)

  // Edit Alias (Display Name) Inline Modal State
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null)
  const [editingDisplayName, setEditingDisplayName] = useState('')
  const [savingAlias, setSavingAlias] = useState(false)

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

  async function handleRoleChange(profileId: string, targetRole: UserRole, email: string) {
    if (profileId === profile?.id) {
      toast.warning('你无法修改自己的角色')
      return
    }

    const targetProfile = profiles.find(p => p.id === profileId)
    if (targetProfile?.role === 'superadmin') {
      toast.error('超级管理员权限不可修改')
      return
    }

    if (targetProfile?.role === 'admin' && !isSuperAdmin) {
      toast.warning('只有超级管理员才能修改管理员的权限')
      return
    }

    const { error } = await supabase
      .from('user_profiles')
      .update({ role: targetRole })
      .eq('id', profileId)

    if (error) {
      toast.error('修改失败: ' + error.message)
    } else {
      toast.success(`已更新 ${email} 的角色为 ${targetRole}`)
      setProfiles(prev =>
        prev.map(p => (p.id === profileId ? { ...p, role: targetRole } : p))
      )
    }
  }

  // Handle Add New User
  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault()
    if (!newEmail.trim()) {
      toast.error('请填写邮箱')
      return
    }

    setAdding(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmail.trim(),
          display_name: newDisplayName.trim() || null,
          role: newRole,
        }),
      })

      const result = await res.json()

      if (!res.ok) {
        console.error('[Add User API Error Response]:', res.status, result)
        const errorMsg = typeof result.error === 'string'
          ? result.error
          : (result.error?.message || (typeof result.error === 'object' ? JSON.stringify(result.error) : '创建用户失败，请检查账号状态'))
        throw new Error(errorMsg)
      }

      toast.success('🎉 新用户创建成功！', {
        description: result.message || `账号: ${newEmail.trim()}，初始密码为 HFfarm2026`,
        duration: 5000,
      })

      setShowAddModal(false)
      setNewEmail('')
      setNewDisplayName('')
      setNewRole('editor')
      fetchProfiles()
    } catch (err: any) {
      console.error('[Add User Error Catch]:', err)
      const desc = typeof err === 'string' ? err : (err?.message || '网络请求异常，请稍后重试')
      toast.error('添加失败', {
        description: desc,
        duration: 6000,
      })
    } finally {
      setAdding(false)
    }
  }

  // Handle Reset Password to HFfarm2026
  async function handleResetPassword(targetProfile: UserProfile) {
    if (!confirm(`确定要重置 ${targetProfile.email} 的密码为“HFfarm2026”吗？`)) {
      return
    }

    setResettingId(targetProfile.id)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: targetProfile.id,
          action: 'reset_password',
        }),
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || '重置密码失败')
      }

      toast.success(`🎉 密码重置成功！`, {
        description: `已重置 ${targetProfile.email} 的密码为 HFfarm2026`,
      })
    } catch (err: any) {
      toast.error('重置密码失败', { description: err.message })
    } finally {
      setResettingId(null)
    }
  }

  // Handle Save Alias
  async function handleSaveAlias(userId: string) {
    setSavingAlias(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          action: 'update_display_name',
          display_name: editingDisplayName.trim() || null,
        }),
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || '更新别名失败')
      }

      toast.success('别名更新成功')
      setProfiles(prev =>
        prev.map(p => (p.id === userId ? { ...p, display_name: editingDisplayName.trim() || null } : p))
      )
      setEditingProfileId(null)
    } catch (err: any) {
      toast.error('修改别名失败', { description: err.message })
    } finally {
      setSavingAlias(false)
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
    <div className="space-y-4 pb-12">
      <Card className="shadow-sm border-gray-100">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base">用户权限与账号管理</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              管理员可以添加新员工、修改使用权限、重置密码及设置用户别名。
            </CardDescription>
          </div>
          <Button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs gap-1.5 h-9 shrink-0 shadow-xs"
          >
            <UserPlus className="w-4 h-4" />
            添加新用户
          </Button>
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
                    <TableHead>别名 (Name)</TableHead>
                    <TableHead className="w-32">权限角色</TableHead>
                    <TableHead className="text-right w-36">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map(p => {
                    const isSelf = p.id === profile?.id
                    const isSuper = p.role === 'superadmin'
                    const isAdminUser = p.role === 'admin'
                    const canEditThisUser = !isSuper && (!isAdminUser || isSuperAdmin)

                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium text-gray-900 text-sm truncate max-w-[180px]">
                          {p.email}
                        </TableCell>

                        {/* Alias / Display Name Column */}
                        <TableCell className="text-gray-600 text-sm">
                          {editingProfileId === p.id ? (
                            <div className="flex items-center gap-1">
                              <Input
                                value={editingDisplayName}
                                onChange={e => setEditingDisplayName(e.target.value)}
                                placeholder="输入别名..."
                                className="h-8 text-xs w-28"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveAlias(p.id)}
                                disabled={savingAlias}
                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                              >
                                {savingAlias ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingProfileId(null)}
                                disabled={savingAlias}
                                className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 group">
                              <span>{p.display_name || <span className="text-gray-300 italic text-xs">未设置</span>}</span>
                              {canEditThisUser && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingProfileId(p.id)
                                    setEditingDisplayName(p.display_name || '')
                                  }}
                                  className="opacity-60 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-700 transition-opacity"
                                  title="编辑别名"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          )}
                        </TableCell>

                        {/* Role Column */}
                        <TableCell>
                          {p.role === 'superadmin' ? (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-semibold w-fit border border-indigo-100">
                              <Crown className="w-3.5 h-3.5" />
                              超级管理员
                            </div>
                          ) : p.role === 'admin' && !isSuperAdmin ? (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 text-xs font-semibold w-fit border border-amber-100">
                              <Lock className="w-3.5 h-3.5" />
                              管理员
                            </div>
                          ) : (
                            <Select
                              disabled={isSelf || !canEditThisUser}
                              defaultValue={p.role}
                              onValueChange={(val) => handleRoleChange(p.id, val as any, p.email)}
                            >
                              <SelectTrigger className="h-8 text-xs">
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

                        {/* Actions Column */}
                        <TableCell className="text-right">
                          {canEditThisUser ? (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleResetPassword(p)}
                                disabled={resettingId === p.id}
                                className="h-8 px-2 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 gap-1"
                                title="密码重置为 HFfarm2026"
                              >
                                {resettingId === p.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <>
                                    <KeyRound className="w-3.5 h-3.5" />
                                    <span>重置密码</span>
                                  </>
                                )}
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden border border-gray-100">
            <div className="px-6 py-4 bg-green-50 border-b border-green-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-green-700" />
                <h3 className="text-base font-bold text-gray-900">添加新系统用户</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">用户邮箱 *</Label>
                <Input
                  type="email"
                  placeholder="user@example.com"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  required
                  className="h-10 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">别名 / 名字（选填）</Label>
                <Input
                  type="text"
                  placeholder="如: 张三 / Tom"
                  value={newDisplayName}
                  onChange={e => setNewDisplayName(e.target.value)}
                  className="h-10 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">系统权限角色</Label>
                <Select value={newRole} onValueChange={(v) => setNewRole(v as UserRole)}>
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="editor">编辑员 (Editor) — 可录入及编辑收菜</SelectItem>
                    <SelectItem value="viewer">查看员 (Viewer) — 仅能查看数据</SelectItem>
                    <SelectItem value="admin">管理员 (Admin) — 拥有最高管理权限</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-800 leading-relaxed">
                <span className="font-bold block mb-0.5">💡 密码提示</span>
                创建后系统默认初始密码为 <span className="font-extrabold font-mono text-amber-900 bg-amber-100 px-1 py-0.5 rounded">HFfarm2026</span>，通知员工使用该初始密码登录即可。
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-11"
                  onClick={() => setShowAddModal(false)}
                  disabled={adding}
                >
                  取消
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-11 bg-green-600 hover:bg-green-700 text-white font-bold"
                  disabled={adding}
                >
                  {adding ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-1" />创建中...</>
                  ) : (
                    '确认创建'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
