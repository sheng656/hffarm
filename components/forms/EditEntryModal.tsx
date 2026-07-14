'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ProductSearch } from '@/components/forms/ProductSearch'
import { NumberStepper } from '@/components/forms/NumberStepper'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { TEAMS, CRATES, GREENHOUSES, PALLETS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { Product, HarvestEntryWithProduct } from '@/lib/types'
import { Loader2 } from 'lucide-react'

const supabase = createClient()

// Combobox-style select that allows free-form input
function FreeCombobox({
  value, onChange, options, placeholder,
}: {
  value: string
  onChange: (v: string) => void
  options: readonly string[]
  placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const filtered = options.filter(o =>
    o.toLowerCase().includes(value.toLowerCase())
  )

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white rounded-lg border border-gray-200 shadow-lg max-h-48 overflow-y-auto">
          {filtered.map(opt => (
            <button
              key={opt}
              type="button"
              onMouseDown={() => { onChange(opt); setOpen(false) }}
              className={cn(
                'w-full text-left px-4 py-3 text-sm hover:bg-green-50 hover:text-green-700 transition-colors',
                value === opt && 'bg-green-50 text-green-700 font-medium',
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface EditEntryModalProps {
  entry: HarvestEntryWithProduct | null
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export function EditEntryModal({ entry, open, onClose, onSaved }: EditEntryModalProps) {
  const [selectedProductId, setSelectedProductId] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [team, setTeam] = useState('')
  const [crate, setCrate] = useState('')
  const [pallet, setPallet] = useState('')
  const [greenhouse, setGreenhouse] = useState('')
  const [qtyMode, setQtyMode] = useState<'bag' | 'loose'>('bag')
  const [quantity, setQuantity] = useState(0)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Initialize states when entry changes or modal opens
  useEffect(() => {
    if (entry && open) {
      setSelectedProductId(entry.product_id)
      setSelectedProduct(entry.product)
      setTeam(entry.team)
      setCrate(entry.crate)
      setPallet(entry.pallet)
      setGreenhouse(entry.greenhouse_no)
      const mode = entry.bag_qty > 0 ? 'bag' : 'loose'
      setQtyMode(mode)
      setQuantity(mode === 'bag' ? entry.bag_qty : entry.loose_qty)
      setNotes(entry.notes ?? '')
    }
  }, [entry, open])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!entry) return
    if (!selectedProductId) { toast.error('请选择产品'); return }
    if (!team) { toast.error('请选择团队'); return }
    if (!crate) { toast.error('请选择箱型'); return }
    if (!greenhouse) { toast.error('请选择或输入大棚编号'); return }
    if (quantity <= 0) { toast.error('请输入有效数量'); return }

    setSubmitting(true)
    const finalBagQty = qtyMode === 'bag' ? quantity : 0
    const finalLooseQty = qtyMode === 'loose' ? quantity : 0

    try {
      const { error } = await supabase
        .from('harvest_entries')
        .update({
          product_id: selectedProductId,
          bag_qty: finalBagQty,
          loose_qty: finalLooseQty,
          crate,
          pallet,
          greenhouse_no: greenhouse,
          team,
          notes: notes || null,
        })
        .eq('id', entry.id)

      if (error) {
        toast.error('保存失败: ' + error.message)
      } else {
        toast.success('修改成功')
        onSaved()
        onClose()
      }
    } catch (err: any) {
      toast.error('保存出错: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">编辑收菜记录</DialogTitle>
          <DialogDescription className="text-xs text-gray-500">修改已录入的成品菜收运明细数据。</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 pt-2">
          {/* Product Search */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-gray-700">选择产品 *</Label>
            <ProductSearch
              value={selectedProductId}
              onChange={(id, product) => {
                setSelectedProductId(id)
                setSelectedProduct(product)
              }}
            />
            {selectedProduct?.stockcode && (
              <p className="text-xs text-muted-foreground">{selectedProduct.stockcode} — {selectedProduct.exo_description}</p>
            )}
          </div>

          {/* Team Selection */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-gray-700">团队 *</Label>
            <div className="grid grid-cols-6 gap-1">
              {TEAMS.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTeam(t)}
                  className={cn(
                    'h-10 rounded-lg font-bold text-base transition-all duration-150 border',
                    team === t
                      ? 'bg-green-600 text-white border-green-600 shadow-sm'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-green-300 hover:bg-green-50 active:scale-95',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Crate Selection */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-gray-700">箱型 *</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {CRATES.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCrate(c)}
                  className={cn(
                    'h-9 rounded-lg text-xs font-medium transition-all duration-150 border',
                    crate === c
                      ? 'bg-green-600 text-white border-green-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-green-300 hover:bg-green-50',
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Pallet Selection */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-gray-700">板型 *</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {PALLETS.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPallet(p)}
                  className={cn(
                    'h-9 rounded-lg text-xs font-medium transition-all duration-150 border',
                    pallet === p
                      ? 'bg-green-600 text-white border-green-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-green-300 hover:bg-green-50',
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Greenhouse Selection */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-gray-700">大棚编号 *</Label>
            <FreeCombobox value={greenhouse} onChange={setGreenhouse} options={GREENHOUSES} placeholder="输入或选择大棚编号..." />
          </div>

          {/* Quantity Type selection */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-gray-700">数量类型 *</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setQtyMode('bag') }}
                className={cn(
                  'h-10 rounded-lg text-xs font-bold transition-all duration-150 border',
                  qtyMode === 'bag'
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-green-300 hover:bg-green-50',
                )}
              >
                Bag（包数）
              </button>
              <button
                type="button"
                onClick={() => { setQtyMode('loose') }}
                className={cn(
                  'h-10 rounded-lg text-xs font-bold transition-all duration-150 border',
                  qtyMode === 'loose'
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-green-300 hover:bg-green-50',
                )}
              >
                Loose（散数）
              </button>
            </div>
          </div>

          {/* Quantity input */}
          <NumberStepper
            label={qtyMode === 'bag' ? '包数数量 (Bag)' : '散数数量 (Loose)'}
            value={quantity}
            onChange={setQuantity}
          />

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-gray-700">备注（选填）</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="如有备注请填写..."
              className="resize-none text-base"
              rows={2}
            />
          </div>

          <DialogFooter className="mt-4 pt-2 border-t flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 h-12"
              disabled={submitting}
            >
              取消
            </Button>
            <Button
              type="submit"
              className="flex-1 h-12 bg-green-600 hover:bg-green-700"
              disabled={submitting}
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />保存中...</>
              ) : (
                '保存修改'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
