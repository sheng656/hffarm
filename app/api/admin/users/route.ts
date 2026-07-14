import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Initialize Supabase Admin client using Service Role Key
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing in environment variables')
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// Helper: Verify if requestor is Admin or SuperAdmin
async function verifyAdmin() {
  const serverClient = await createServerClient()
  const { data: { user } } = await serverClient.auth.getUser()
  
  if (!user) {
    return { authorized: false, error: 'Unauthorized', user: null, profile: null }
  }

  const { data: profile } = await serverClient
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin'
  if (!isAdmin) {
    return { authorized: false, error: 'Forbidden: Admin access required', user, profile }
  }

  return { authorized: true, error: null, user, profile }
}

// POST: Create a new user
export async function POST(request: Request) {
  try {
    const { authorized, error: authError, profile: operatorProfile } = await verifyAdmin()
    if (!authorized) {
      return NextResponse.json({ error: authError || '无操作权限' }, { status: 403 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      console.error('[API Create User Error]: Missing SUPABASE_SERVICE_ROLE_KEY in environment variables')
      return NextResponse.json({
        error: '服务端未配置 SUPABASE_SERVICE_ROLE_KEY 环境变量，请在 Vercel 设置中添加。'
      }, { status: 500 })
    }

    const body = await request.json()
    const { email, display_name, role } = body

    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
    if (!cleanEmail) {
      return NextResponse.json({ error: '邮箱为必填项' }, { status: 400 })
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(cleanEmail)) {
      return NextResponse.json({ error: '输入的邮箱格式不正确' }, { status: 400 })
    }

    const targetRole = role || 'editor'
    if (targetRole === 'superadmin' && operatorProfile?.role !== 'superadmin') {
      return NextResponse.json({ error: '只有超级管理员才能设置超级管理员角色' }, { status: 403 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // 1. Create User in Auth with default password HFfarm2026
    const { data: newAuth, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password: 'HFfarm2026',
      email_confirm: true,
    })

    if (createError) {
      console.error('[API Create User Auth Error]:', createError)
      let msg = createError.message
      if (msg.includes('already been registered') || msg.includes('already exists')) {
        msg = `邮箱 ${cleanEmail} 已在 Supabase 账号库中注册过，请检查列表或重置该账号密码。`
      } else if (msg.includes('Password should be')) {
        msg = '默认密码不满足 Supabase 的密码强度规则要求。'
      }
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const userId = newAuth.user.id

    // 2. The database trigger handle_new_user automatically inserts user_profile with role 'editor'
    // Now update profile if display_name or role differs
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .update({
        display_name: display_name ? display_name.trim() : null,
        role: targetRole,
      })
      .eq('id', userId)

    if (profileError) {
      console.error('[API Update Profile Error after creation]:', profileError)
    }

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        email: newAuth.user.email,
        display_name: display_name ? display_name.trim() : null,
        role: targetRole,
      },
    })
  } catch (err: any) {
    console.error('[API Create User Catch Error]:', err)
    return NextResponse.json({ error: err.message || '服务器内部错误' }, { status: 500 })
  }
}

// PATCH: Reset password or edit user display name
export async function PATCH(request: Request) {
  try {
    const { authorized, error: authError, profile: operatorProfile } = await verifyAdmin()
    if (!authorized) {
      return NextResponse.json({ error: authError }, { status: 403 })
    }

    const body = await request.json()
    const { userId, action, display_name } = body

    if (!userId) {
      return NextResponse.json({ error: '缺少用户 ID' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Fetch target user profile
    const { data: targetProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (targetProfile?.role === 'superadmin' && operatorProfile?.role !== 'superadmin') {
      return NextResponse.json({ error: '无法修改超级管理员账号' }, { status: 403 })
    }

    if (action === 'reset_password') {
      // Reset password to HFfarm2026
      const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: 'HFfarm2026',
      })

      if (resetError) {
        return NextResponse.json({ error: resetError.message }, { status: 400 })
      }

      return NextResponse.json({ success: true, message: '密码已成功重置为 HFfarm2026' })
    }

    if (action === 'update_display_name') {
      const { error: updateError } = await supabaseAdmin
        .from('user_profiles')
        .update({ display_name: display_name || null })
        .eq('id', userId)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 })
      }

      return NextResponse.json({ success: true, message: '别名已更新' })
    }

    return NextResponse.json({ error: '无效的操作类型' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
