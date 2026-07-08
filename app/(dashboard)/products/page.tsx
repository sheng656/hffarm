'use client'

import { useState } from 'react'
import { mutate } from 'swr'
import { createClient } from '@/lib/supabase/client'
import { useProducts } from '@/hooks/useProducts'
import { useUser } from '@/hooks/useUser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Loader2, Plus, Search, Edit2, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import type { Product } from '@/lib/types'

const supabase = createClient()

export default function ProductsPage() {
  const { isAdmin } = useUser()
  const { data: products = [], isLoading } = useProducts()
  const [search, setSearch] = useState('')
  
  // Dialog States
  const [open, setOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  
  // Form States
  const [factoryName, setFactoryName] = useState('')
  const [stockcode, setStockcode] = useState('')
  const [exoDesc, setExoDesc] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)

  const filtered = products.filter(p =>
    p.factory_product_name.toLowerCase().includes(search.toLowerCase()) ||
    (p.stockcode && p.stockcode.toLowerCase().includes(search.toLowerCase())) ||
    (p.exo_description && p.exo_description.toLowerCase().includes(search.toLowerCase()))
  )

  const openAddDialog = () => {
    setEditingProduct(null)
    setFactoryName('')
    setStockcode('')
    setExoDesc('')
    setIsActive(true)
    setOpen(true)
  }

  const openEditDialog = (product: Product) => {
    setEditingProduct(product)
    setFactoryName(product.factory_product_name)
    setStockcode(product.stockcode ?? '')
    setExoDesc(product.exo_description ?? '')
    setIsActive(product.is_active)
    setOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!factoryName) { toast.error('产品名称不能为空'); return }
    
    setSaving(true)
    
    if (editingProduct) {
      // Update
      const { error } = await supabase
        .from('products')
        .update({
          factory_product_name: factoryName,
          stockcode: stockcode || null,
          exo_description: exoDesc || null,
          is_active: isActive
        })
        .eq('id', editingProduct.id)

      if (error) {
        toast.error('更新失败: ' + error.message)
      } else {
        toast.success('产品更新成功')
        setOpen(false)
        mutate('products')
      }
    } else {
      // Insert
      // Generate custom sequential product_id (e.g. P0281, P0282, etc.)
      const nextNum = products.length + 1
      const generatedProductId = 'P' + String(nextNum).padStart(4, '0')

      const { error } = await supabase
        .from('products')
        .insert({
          product_id: generatedProductId,
          factory_product_name: factoryName,
          stockcode: stockcode || null,
          exo_description: exoDesc || null,
          is_active: isActive
        })

      if (error) {
        toast.error('添加失败: ' + error.message)
      } else {
        toast.success('新产品添加成功', { description: `编号: ${generatedProductId}` })
        setOpen(false)
        mutate('products')
      }
    }
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      {/* Search Bar + Add Button */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索产品库..."
            className="pl-10 h-12 text-base"
          />
        </div>
        {isAdmin && (
          <Button onClick={openAddDialog} className="h-12 px-4 bg-green-600 hover:bg-green-700">
            <Plus className="w-5 h-5 mr-1" />添加
          </Button>
        )}
      </div>

      {/* Admin Alert */}
      {!isAdmin && (
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs text-gray-500">
          <ShieldAlert className="w-3.5 h-3.5 text-gray-400" />
          <span>查看权限：只有管理员可以编辑和新增产品。</span>
        </div>
      )}

      {/* Products list */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">未找到匹配的产品</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(product => (
            <Card key={product.id} className="shadow-none border-gray-100 bg-white">
              <CardContent className="flex items-center justify-between p-4">
                <div className="min-w-0 pr-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm truncate">
                      {product.factory_product_name}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono py-0 px-1 font-medium bg-gray-50 text-gray-500">
                      {product.product_id}
                    </Badge>
                    {!product.is_active && (
                      <Badge variant="destructive" className="text-[9px] py-0 px-1 font-semibold">已停用</Badge>
                    )}
                  </div>
                  {product.stockcode && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {product.stockcode} · {product.exo_description}
                    </p>
                  )}
                </div>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(product)}
                    className="text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog for Add / Edit */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[450px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">{editingProduct ? '编辑产品' : '添加产品'}</DialogTitle>
            <DialogDescription>
              {editingProduct ? `正在修改产品 ${editingProduct.product_id} 的信息` : '添加新的成品菜规格到产品库'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="factory-name">工厂产品名称 *</Label>
              <Input
                id="factory-name"
                value={factoryName}
                onChange={e => setFactoryName(e.target.value)}
                placeholder="例如: Shanghai-loose 3kg"
                required
              />
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="stockcode">EXO Stockcode (选填)</Label>
              <Input
                id="stockcode"
                value={stockcode}
                onChange={e => setStockcode(e.target.value)}
                placeholder="例如: S/V0001"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="exo-desc">EXO 描述 (选填)</Label>
              <Input
                id="exo-desc"
                value={exoDesc}
                onChange={e => setExoDesc(e.target.value)}
                placeholder="例如: Shanghai Bok Choy Loose"
              />
            </div>

            <div className="flex items-center justify-between py-2 border-t border-b border-gray-100">
              <div className="space-y-0.5">
                <Label htmlFor="active" className="text-sm font-semibold">状态</Label>
                <p className="text-xs text-muted-foreground">停用后，录入时将无法选择此产品</p>
              </div>
              <input
                id="active"
                type="checkbox"
                checked={isActive}
                onChange={e => setIsActive(e.target.checked)}
                className="w-5 h-5 accent-green-600 rounded"
              />
            </div>

            <DialogFooter className="gap-2 mt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="h-11">
                取消
              </Button>
              <Button type="submit" className="h-11 bg-green-600 hover:bg-green-700" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : '保存'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
