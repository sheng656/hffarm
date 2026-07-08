'use client'

import { useState, useCallback } from 'react'
import { mutate } from 'swr'
import { createClient } from '@/lib/supabase/client'
import { ProductSearch } from '@/components/forms/ProductSearch'
import { NumberStepper } from '@/components/forms/NumberStepper'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Trash2, ChevronRight, CheckCircle2, ChevronUp, ChevronDown, CalendarIcon, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { TEAMS, CRATES, GREENHOUSES, PALLETS } from '@/lib/constants'
import { useHarvestEntries } from '@/hooks/useHarvestEntries'
import { useUser } from '@/hooks/useUser'
import { cn } from '@/lib/utils'
import { formatAucklandDate, formatAucklandDateLabel, formatAucklandTime, toAucklandCalendarDate } from '@/lib/auckland-time'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { Product, HarvestEntryWithProduct } from '@/lib/types'

const supabase = createClient()
const TODAY = formatAucklandDate()

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

export default function RegisterPage() {
  const { profile, isEditor } = useUser()
  const [selectedDate, setSelectedDate] = useState(TODAY)
  const [calOpen, setCalOpen] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const { data: todayEntries = [], isLoading: loadingEntries } = useHarvestEntries({ date: selectedDate })

  const [selectedProductId, setSelectedProductId] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [team, setTeam] = useState('')
  const [crate, setCrate] = useState('')
  const [pallet, setPallet] = useState('NPO')
  const [greenhouse, setGreenhouse] = useState('')
  const [qtyMode, setQtyMode] = useState<'bag' | 'loose'>('bag')
  const [quantity, setQuantity] = useState(0)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [isTodayListExpanded, setIsTodayListExpanded] = useState(false)

  const resetForm = useCallback(() => {
    setQuantity(0)
    setNotes('')
    // Keep product, team, crate, pallet, greenhouse for quick re-entry
  }, [])

  async function executeSubmit() {
    if (submitting) return

    setShowConfirmModal(false)
    setSubmitting(true)

    const submissionDate = selectedDate

    const finalBagQty = qtyMode === 'bag' ? quantity : 0
    const finalLooseQty = qtyMode === 'loose' ? quantity : 0

    try {
      const { data: { user } } = await supabase.auth.getUser()

      const { error } = await supabase.from('harvest_entries').insert({
        entry_date: submissionDate,
        product_id: selectedProductId,
        bag_qty: finalBagQty,
        loose_qty: finalLooseQty,
        crate,
        pallet,
        greenhouse_no: greenhouse,
        team,
        notes: notes || null,
        created_by: user?.id,
        created_by_email: user?.email,
      })

      if (error) {
        toast.error('提交失败', { description: error.message })
        return
      }

      toast.success('✅ 录入成功！', {
        description: `${selectedProduct?.factory_product_name} × ${quantity} (${qtyMode === 'bag' ? '包' : '散'})`,
      })
      resetForm()
      mutate(`harvest:${submissionDate}:all:all`)
      mutate(`harvest:${submissionDate}:${team}:all`)
      mutate((key: string) => typeof key === 'string' && key.startsWith(`harvest:${submissionDate}:`), undefined, { revalidate: true })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedProductId) { toast.error('请选择产品'); return }
    if (!team) { toast.error('请选择团队'); return }
    if (!crate) { toast.error('请选择箱型'); return }
    if (!greenhouse) { toast.error('请选择或输入大棚编号'); return }
    if (quantity <= 0) { toast.error('请输入有效数量'); return }

    if (selectedDate !== TODAY) {
      setShowConfirmModal(true)
      return
    }

    await executeSubmit()
  }

  async function handleConfirmSubmit() {
    await executeSubmit()
  }

  async function handleDelete(entryId: string) {
    const { error } = await supabase.from('harvest_entries').delete().eq('id', entryId)
    if (error) {
      toast.error('删除失败')
    } else {
      toast.success('已删除')
      mutate(`harvest:${selectedDate}:all:all`)
      mutate((key: string) => typeof key === 'string' && key.startsWith('harvest:' + selectedDate), undefined, { revalidate: true })
    }
  }

  if (!isEditor) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-3">
        <div className="text-4xl">🔒</div>
        <h2 className="font-semibold text-lg text-gray-800">无权限录入</h2>
        <p className="text-gray-500 text-sm">你的账号为查看权限，如需录入请联系管理员</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Date Picker Card */}
      <Card className="shadow-sm border-gray-100">
        <CardContent className="pt-5 space-y-2">
          <Label className="text-sm font-semibold text-gray-700">录入日期</Label>
          <Popover open={calOpen} onOpenChange={setCalOpen}>
            <PopoverTrigger
              render={
                <Button variant="outline" className="w-full h-12 justify-between text-base">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-green-600" />
                    {formatAucklandDateLabel(selectedDate)}
                  </div>
                  <span className="text-xs text-gray-400">可选今日及以前</span>
                </Button>
              }
            />
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar
                mode="single"
                selected={toAucklandCalendarDate(selectedDate)}
                onSelect={date => {
                  if (date) {
                    setSelectedDate(formatAucklandDate(date))
                    setCalOpen(false)
                  }
                }}
                disabled={date => formatAucklandDate(date) > TODAY}
              />
            </PopoverContent>
          </Popover>
          <p className="text-xs text-gray-400">选择历史日期时，提交前会再次确认，避免误录。</p>
        </CardContent>
      </Card>

      {/* Form Card */}
      <Card className="shadow-sm border-gray-100">
        <CardContent className="pt-5">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Product Search */}
            <div className="space-y-2">
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
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-700">团队 *</Label>
              <div className="grid grid-cols-3 gap-2">
                {TEAMS.map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTeam(t)}
                    className={cn(
                      'h-12 rounded-xl font-bold text-lg transition-all duration-150 border-2',
                      team === t
                        ? 'bg-green-600 text-white border-green-600 shadow-md scale-[1.02]'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-green-300 hover:bg-green-50 active:scale-95',
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Crate Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-700">箱型 *</Label>
              <div className="grid grid-cols-3 gap-2">
                {CRATES.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCrate(c)}
                    className={cn(
                      'h-11 rounded-xl text-sm font-medium transition-all duration-150 border-2',
                      crate === c
                        ? 'bg-green-600 text-white border-green-600 shadow-sm'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-green-300 hover:bg-green-50 active:scale-95',
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Pallet Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-700">板型 *</Label>
              <div className="grid grid-cols-3 gap-2">
                {PALLETS.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPallet(p)}
                    className={cn(
                      'h-11 rounded-xl text-sm font-medium transition-all duration-150 border-2',
                      pallet === p
                        ? 'bg-green-600 text-white border-green-600 shadow-sm'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-green-300 hover:bg-green-50 active:scale-95',
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Greenhouse Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-700">大棚编号 *</Label>
              <FreeCombobox value={greenhouse} onChange={setGreenhouse} options={GREENHOUSES} placeholder="输入或选择大棚编号..." />
            </div>

            {/* Quantity Type selection (二选一) */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-700">数量类型 *</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setQtyMode('bag'); setQuantity(0) }}
                  className={cn(
                    'h-12 rounded-xl text-sm font-bold transition-all duration-150 border-2',
                    qtyMode === 'bag'
                      ? 'bg-green-600 text-white border-green-600 shadow-md'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-green-300 hover:bg-green-50 active:scale-95',
                  )}
                >
                  Bag（包数）
                </button>
                <button
                  type="button"
                  onClick={() => { setQtyMode('loose'); setQuantity(0) }}
                  className={cn(
                    'h-12 rounded-xl text-sm font-bold transition-all duration-150 border-2',
                    qtyMode === 'loose'
                      ? 'bg-green-600 text-white border-green-600 shadow-md'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-green-300 hover:bg-green-50 active:scale-95',
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

            {/* Total preview */}
            {quantity > 0 && (
              <div className="flex items-center justify-between bg-green-50 rounded-xl px-4 py-2.5">
                <span className="text-sm text-green-700">录入总数量 ({qtyMode === 'bag' ? '包' : '散'})</span>
                <span className="text-2xl font-bold text-green-700">{quantity}</span>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-700">备注（选填）</Label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="如有备注请填写..."
                className="resize-none text-base"
                rows={2}
              />
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full h-14 text-base font-bold bg-green-600 hover:bg-green-700 active:scale-[0.98] shadow-md"
              disabled={submitting}
            >
              {submitting ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" />提交中...</>
              ) : (
                '✅ 提交记录'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg rounded-3xl bg-white/95 shadow-2xl ring-1 ring-black/5 overflow-hidden">
            <div className="px-6 py-5 bg-gradient-to-r from-amber-50 to-yellow-50 border-b border-amber-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">确认历史日期录入</h3>
                  <p className="text-sm text-gray-600">你正在提交非今日数据，请确认这不是误操作。</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
                <p className="text-sm font-semibold">警告</p>
                <p className="mt-1 text-sm leading-6">
                  当前选择的录入日期是 <span className="font-extrabold text-amber-700">{formatAucklandDateLabel(selectedDate)}</span>，
                  不是今日 {formatAucklandDateLabel(TODAY)}。
                  确认后将按该历史日期入库，并同步到下方对应日期列表。
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-12 rounded-xl"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={submitting}
                >
                  取消
                </Button>
                <Button
                  type="button"
                  className="flex-1 h-12 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold"
                  onClick={handleConfirmSubmit}
                  disabled={submitting}
                >
                  {submitting ? '提交中...' : '确认提交'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Today's entries list */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setIsTodayListExpanded(!isTodayListExpanded)}
          className="w-full flex items-center justify-between bg-white hover:bg-gray-50 border border-gray-100 px-4 py-3 rounded-xl shadow-sm active:scale-[0.99] transition-all duration-150"
        >
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
              {selectedDate === TODAY ? '今日已录入' : `${formatAucklandDateLabel(selectedDate)} 已录入`}
            </h2>
            <Badge variant="secondary" className="text-[11px] py-0 px-1.5 bg-gray-100 text-gray-600 font-bold">
              {todayEntries.length} 条
            </Badge>
          </div>
          <span className="text-xs text-green-600 font-semibold flex items-center gap-1">
            {isTodayListExpanded ? (
              <>收起 <ChevronUp className="w-3.5 h-3.5" /></>
            ) : (
              <>展开查看 <ChevronDown className="w-3.5 h-3.5" /></>
            )}
          </span>
        </button>

        {isTodayListExpanded && (
          <>
            {loadingEntries ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
              </div>
            ) : todayEntries.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm bg-white rounded-xl border border-gray-100">该日期暂无记录</div>
            ) : (
              <div className="space-y-2">
                {todayEntries.map(entry => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    currentUserId={profile?.id ?? ''}
                    isAdmin={profile?.role === 'admin'}
                    activeDate={selectedDate}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function EntryCard({
  entry,
  currentUserId,
  isAdmin,
  activeDate,
  onDelete,
}: {
  entry: HarvestEntryWithProduct
  currentUserId: string
  isAdmin: boolean
  activeDate: string
  onDelete: (id: string) => void
}) {
  const canDelete = isAdmin || (entry.created_by === currentUserId && entry.entry_date === activeDate)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    await onDelete(entry.id)
    setDeleting(false)
  }

  const entryTime = entry.created_at ? formatAucklandTime(entry.created_at) : ''

  return (
    <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm slide-in">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900 truncate">
            {entry.product?.factory_product_name}
          </span>
          <Badge variant="secondary" className="text-[11px] py-0 px-1.5 h-5 bg-green-100 text-green-700 font-bold">
            {entry.total_qty}
          </Badge>
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-gray-400">
          <span className="font-semibold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">{entry.team}</span>
          <span>{entry.crate}</span>
          <span>{entry.greenhouse_no}</span>
          {entry.bag_qty > 0 && <span>Bag×{entry.bag_qty}</span>}
          {entry.loose_qty > 0 && <span>Loose×{entry.loose_qty}</span>}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {entryTime && (
          <span className="text-[11px] text-gray-400 font-medium bg-gray-50 px-1.5 py-0.5 rounded">
            {entryTime}
          </span>
        )}

        {canDelete && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 active:scale-95 transition-all"
            aria-label="删除"
          >
            {deleting
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Trash2 className="w-4 h-4" />
            }
          </button>
        )}
      </div>
    </div>
  )
}
