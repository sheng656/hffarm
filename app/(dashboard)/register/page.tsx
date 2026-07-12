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
import { Loader2, Trash2, ChevronRight, CheckCircle2, ChevronUp, ChevronDown, CalendarIcon, AlertCircle, Pencil, Plus, Layers } from 'lucide-react'
import { toast } from 'sonner'
import { TEAMS, CRATES, GREENHOUSES, PALLETS } from '@/lib/constants'
import { useHarvestEntries } from '@/hooks/useHarvestEntries'
import { useUser } from '@/hooks/useUser'
import { cn } from '@/lib/utils'
import { formatAucklandDate, formatAucklandDateLabel, formatAucklandTime, toAucklandCalendarDate } from '@/lib/auckland-time'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { EditEntryModal } from '@/components/forms/EditEntryModal'
import type { Product, HarvestEntryWithProduct } from '@/lib/types'

const supabase = createClient()
const TODAY = formatAucklandDate()

interface TempEntry {
  id: string
  product: Product
  productId: string
  team: string
  crate: string
  greenhouse: string
  qtyMode: 'bag' | 'loose'
  quantity: number
  notes: string
}

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

  // Board-level states
  const [palletType, setPalletType] = useState<string>('') // Initially empty
  const [tempEntries, setTempEntries] = useState<TempEntry[]>([])

  // Product detail input states
  const [selectedProductId, setSelectedProductId] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [team, setTeam] = useState('')
  const [crate, setCrate] = useState('')
  const [greenhouse, setGreenhouse] = useState('')
  const [qtyMode, setQtyMode] = useState<'bag' | 'loose'>('bag')
  const [quantity, setQuantity] = useState(0)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  
  // Modal states
  const [isTodayListExpanded, setIsTodayListExpanded] = useState(false)
  const [editingEntry, setEditingEntry] = useState<HarvestEntryWithProduct | null>(null)

  // Add a product entry to the temporary current board list
  const handleAddToBoard = () => {
    if (!palletType) { toast.error('请先选择板型'); return }
    if (!selectedProductId) { toast.error('请选择产品'); return }
    if (!team) { toast.error('请选择团队'); return }
    if (!crate) { toast.error('请选择箱型'); return }
    if (!greenhouse) { toast.error('请选择或输入大棚编号'); return }
    if (quantity <= 0) { toast.error('请输入有效数量'); return }

    const newTemp: TempEntry = {
      id: Math.random().toString(),
      product: selectedProduct!,
      productId: selectedProductId,
      team,
      crate,
      greenhouse,
      qtyMode,
      quantity,
      notes,
    }

    setTempEntries([...tempEntries, newTemp])
    // Reset product detail fields to allow adding more products, but keep team, crate, greenhouse for quick entry
    setSelectedProductId('')
    setSelectedProduct(null)
    setQuantity(0)
    setNotes('')
    toast.success('已添加到当前板')
  }

  // Remove a product from the temporary board list
  const handleRemoveFromTempBoard = (tempId: string) => {
    setTempEntries(tempEntries.filter(e => e.id !== tempId))
  }

  // Submit the entire board (pallet + entries)
  const executeSubmitBoard = async () => {
    if (submitting) return
    if (tempEntries.length === 0) { toast.error('当前板上无任何产品记录'); return }
    if (!palletType) { toast.error('请选择板型'); return }

    setShowConfirmModal(false)
    setSubmitting(true)
    const submissionDate = selectedDate

    try {
      const { data: { user } } = await supabase.auth.getUser()

      // 1. Insert pallet record
      const { data: palletRecord, error: palletError } = await supabase
        .from('pallets')
        .insert({
          entry_date: submissionDate,
          pallet_type: palletType,
          created_by: user?.id,
          created_by_email: user?.email,
        })
        .select()
        .single()

      if (palletError) {
        toast.error('创建板记录失败', { description: palletError.message })
        setSubmitting(false)
        return
      }

      // 2. Map and insert all harvest entries
      const entriesToInsert = tempEntries.map(e => ({
        entry_date: submissionDate,
        product_id: e.productId,
        bag_qty: e.qtyMode === 'bag' ? e.quantity : 0,
        loose_qty: e.qtyMode === 'loose' ? e.quantity : 0,
        crate: e.crate,
        pallet: palletType,
        pallet_id: palletRecord.id,
        greenhouse_no: e.greenhouse,
        team: e.team,
        notes: e.notes || null,
        created_by: user?.id,
        created_by_email: user?.email,
      }))

      const { error: entriesError } = await supabase.from('harvest_entries').insert(entriesToInsert)

      if (entriesError) {
        toast.error('提交明细失败', { description: entriesError.message })
        // Attempt to clean up orphan pallet
        await supabase.from('pallets').delete().eq('id', palletRecord.id)
        return
      }

      toast.success('🎉 整板提交成功！', {
        description: `已登记一板 ${palletType}，包含 ${tempEntries.length} 条产品记录。`
      })

      // Reset board-level states
      setTempEntries([])
      setPalletType('') // Reset pallet type selection to empty

      // Trigger mutate
      mutate(`harvest:${submissionDate}:all:all`)
      mutate((key: string) => typeof key === 'string' && key.startsWith(`harvest:${submissionDate}:`), undefined, { revalidate: true })
    } catch (err: any) {
      toast.error('提交失败', { description: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  const handleStartSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!palletType) { toast.error('请先选择板型'); return }
    if (tempEntries.length === 0) { toast.error('请先添加产品到当前板'); return }

    if (selectedDate !== TODAY) {
      setShowConfirmModal(true)
      return
    }

    executeSubmitBoard()
  }

  // Deletion logic
  const handleDeleteEntry = async (entryId: string, palletId?: string | null) => {
    const { error } = await supabase.from('harvest_entries').delete().eq('id', entryId)
    if (error) {
      toast.error('删除记录失败')
      return
    }
    
    toast.success('已删除记录')

    // If this belonged to a pallet, check if it was the last entry. If so, delete the pallet.
    if (palletId) {
      const { data: remaining, error: countError } = await supabase
        .from('harvest_entries')
        .select('id')
        .eq('pallet_id', palletId)
      
      if (!countError && (!remaining || remaining.length === 0)) {
        await supabase.from('pallets').delete().eq('id', palletId)
      }
    }

    mutate(`harvest:${selectedDate}:all:all`)
    mutate((key: string) => typeof key === 'string' && key.startsWith('harvest:' + selectedDate), undefined, { revalidate: true })
  }

  const handleDeletePallet = async (palletId: string) => {
    // Delete harvest entries on this board first
    const { error: err1 } = await supabase.from('harvest_entries').delete().eq('pallet_id', palletId)
    if (err1) {
      toast.error('删除板内记录失败')
      return
    }

    // Delete the pallet record
    const { error: err2 } = await supabase.from('pallets').delete().eq('id', palletId)
    if (err2) {
      toast.error('删除板记录失败')
      return
    }

    toast.success('已成功删除整板')
    mutate(`harvest:${selectedDate}:all:all`)
    mutate((key: string) => typeof key === 'string' && key.startsWith('harvest:' + selectedDate), undefined, { revalidate: true })
  }

  // Group entries for rendering
  const getGroupedEntries = () => {
    const flatEntries: HarvestEntryWithProduct[] = []
    const boardGroups = new Map<string, { palletType: string; createdTime: string; creatorEmail: string; entries: HarvestEntryWithProduct[] }>()

    todayEntries.forEach(entry => {
      if (entry.pallet_id) {
        if (!boardGroups.has(entry.pallet_id)) {
          boardGroups.set(entry.pallet_id, {
            palletType: entry.pallet,
            createdTime: entry.created_at,
            creatorEmail: entry.created_by_email ?? '',
            entries: []
          })
        }
        boardGroups.get(entry.pallet_id)!.entries.push(entry)
      } else {
        flatEntries.push(entry)
      }
    })

    return {
      flatEntries,
      boardGroups: Array.from(boardGroups.entries()).sort((a, b) => b[1].createdTime.localeCompare(a[1].createdTime))
    }
  }

  const { flatEntries, boardGroups } = getGroupedEntries()

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
    <div className="space-y-5 pb-12">
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
        </CardContent>
      </Card>

      {/* Main Board Card */}
      <Card className="shadow-sm border-gray-100">
        <CardContent className="pt-5 space-y-5">
          {/* Pallet Selection (Board Type) */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-700 block">选择板型 (Pallet) *</Label>
            <div className="grid grid-cols-3 gap-2">
              {PALLETS.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPalletType(p)}
                  className={cn(
                    'h-12 rounded-xl text-sm font-bold transition-all duration-150 border-2',
                    palletType === p
                      ? 'bg-green-600 text-white border-green-600 shadow-md scale-[1.02]'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-green-300 hover:bg-green-50 active:scale-95',
                  )}
                >
                  {p} 板
                </button>
              ))}
            </div>
            {!palletType && (
              <p className="text-[11px] text-amber-600 flex items-center gap-1 font-medium mt-1">
                <AlertCircle className="w-3.5 h-3.5" /> 物理打板必填，请先点选上方任一板型以开始添加产品。
              </p>
            )}
          </div>

          {/* Current Board Temporary Items List */}
          {palletType && (
            <div className="space-y-3 p-4 bg-green-50/20 border border-green-100 rounded-2xl">
              <div className="flex items-center justify-between border-b border-green-100/50 pb-2">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-green-600" />
                  <span className="text-xs font-bold text-green-800 uppercase">
                    当前正在打：{palletType} 板
                  </span>
                </div>
                <Badge className="bg-green-600 text-white font-bold">
                  {tempEntries.length} 个产品
                </Badge>
              </div>

              {tempEntries.length === 0 ? (
                <p className="text-xs text-gray-400 py-3 text-center">暂无产品，请使用下方表单添加产品到这一板中。</p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {tempEntries.map((e, idx) => (
                    <div key={e.id} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-3 py-2 text-xs shadow-xs">
                      <span className="font-bold text-gray-400 w-4">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-gray-800 truncate">{e.product.factory_product_name}</span>
                          <span className="font-bold text-green-600">×{e.quantity} {e.qtyMode === 'bag' ? '包' : '散'}</span>
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5 flex gap-2 flex-wrap font-medium">
                          <span className="bg-gray-100 text-gray-600 px-1 rounded font-bold">{e.team}</span>
                          <span>{e.crate}</span>
                          <span>{e.greenhouse}</span>
                          {e.notes && <span className="text-amber-600 truncate max-w-[100px]">📝 {e.notes}</span>}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFromTempBoard(e.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Add Product Block (Only active if palletType selected) */}
          {palletType && (
            <div className="border-t border-gray-100 pt-4 space-y-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">添加产品至此板</h3>
              
              {/* Product Search */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-600">选择产品 *</Label>
                <ProductSearch
                  value={selectedProductId}
                  onChange={(id, product) => {
                    setSelectedProductId(id)
                    setSelectedProduct(product)
                  }}
                />
                {selectedProduct?.stockcode && (
                  <p className="text-[11px] text-muted-foreground">{selectedProduct.stockcode} — {selectedProduct.exo_description}</p>
                )}
              </div>

              {/* Team Selection */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-600">团队 *</Label>
                <div className="grid grid-cols-6 gap-1">
                  {TEAMS.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTeam(t)}
                      className={cn(
                        'h-9 rounded-lg font-bold text-base transition-all duration-150 border',
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
                <Label className="text-xs font-semibold text-gray-600">箱型 *</Label>
                <div className="grid grid-cols-3 gap-1">
                  {CRATES.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCrate(c)}
                      className={cn(
                        'h-9 rounded-lg text-xs font-semibold transition-all border',
                        crate === c
                          ? 'bg-green-600 text-white border-green-600 shadow-xs'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-green-300 hover:bg-green-50',
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Greenhouse Selection */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-600">大棚编号 *</Label>
                <FreeCombobox value={greenhouse} onChange={setGreenhouse} options={GREENHOUSES} placeholder="输入或选择大棚编号..." />
              </div>

              {/* Quantity Type selection */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-600">数量类型 *</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setQtyMode('bag'); setQuantity(0) }}
                    className={cn(
                      'h-10 rounded-lg text-xs font-bold transition-all border',
                      qtyMode === 'bag'
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-green-300 hover:bg-green-50',
                    )}
                  >
                    Bag (包数)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setQtyMode('loose'); setQuantity(0) }}
                    className={cn(
                      'h-10 rounded-lg text-xs font-bold transition-all border',
                      qtyMode === 'loose'
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-white text-gray-650 border-gray-200 hover:border-green-300 hover:bg-green-50',
                    )}
                  >
                    Loose (散数)
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
                <Label className="text-xs font-semibold text-gray-600">备注（选填）</Label>
                <Textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="如有备注请填写..."
                  className="resize-none text-sm"
                  rows={2}
                />
              </div>

              <Button
                type="button"
                onClick={handleAddToBoard}
                variant="outline"
                className="w-full h-11 text-xs font-bold border-green-200 text-green-700 bg-green-50/50 hover:bg-green-50 hover:text-green-800"
              >
                <Plus className="w-4 h-4 mr-1" />
                添加到当前板
              </Button>
            </div>
          )}

          {/* Submit整板 */}
          {palletType && tempEntries.length > 0 && (
            <div className="border-t border-gray-150 pt-4">
              <Button
                type="button"
                onClick={handleStartSubmit}
                className="w-full h-14 text-base font-bold bg-green-600 hover:bg-green-700 active:scale-[0.98] shadow-md"
                disabled={submitting}
              >
                {submitting ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" />正在提交整板...</>
                ) : (
                  <>✅ 确认提交整板 ({tempEntries.length} 个产品)</>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm Date Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl ring-1 ring-black/5 overflow-hidden">
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
                  确认后将按该历史日期入库，并同步到已录入列表。
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
                  onClick={executeSubmitBoard}
                  disabled={submitting}
                >
                  {submitting ? '提交中...' : '确认提交'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* List of Entries */}
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
              {todayEntries.length} 条记录
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
              <div className="space-y-3">
                {/* 1. Grouped Boards */}
                {boardGroups.map(([palletId, board]) => (
                  <div key={palletId} className="bg-indigo-50/15 border border-indigo-100/60 rounded-2xl p-3 space-y-2">
                    <div className="flex items-center justify-between border-b border-indigo-100/50 pb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100/40">
                          📦 {board.palletType} 板
                        </span>
                        <span className="text-[10px] text-gray-400 font-medium">
                          {formatAucklandTime(board.createdTime)} · {board.creatorEmail.split('@')[0]}
                        </span>
                      </div>
                      {(profile?.role === 'admin' || profile?.role === 'superadmin' || board.entries[0]?.created_by === profile?.id) && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`确定要删除整板 ${board.palletType} 及里面的 ${board.entries.length} 个产品吗？`)) {
                              handleDeletePallet(palletId)
                            }
                          }}
                          className="text-[10px] text-red-500 hover:text-red-700 font-semibold px-2 py-1 rounded-md hover:bg-red-50 transition-colors"
                        >
                          删除整板
                        </button>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {board.entries.map(entry => (
                        <EntryRow
                          key={entry.id}
                          entry={entry}
                          currentUserId={profile?.id ?? ''}
                          isAdmin={profile?.role === 'admin' || profile?.role === 'superadmin'}
                          activeDate={selectedDate}
                          onDelete={handleDeleteEntry}
                          onEdit={setEditingEntry}
                        />
                      ))}
                    </div>
                  </div>
                ))}

                {/* 2. Flat/Independent Entries */}
                {flatEntries.length > 0 && (
                  <div className="space-y-2">
                    {flatEntries.map(entry => (
                      <EntryRow
                        key={entry.id}
                        entry={entry}
                        currentUserId={profile?.id ?? ''}
                        isAdmin={profile?.role === 'admin' || profile?.role === 'superadmin'}
                        activeDate={selectedDate}
                        onDelete={handleDeleteEntry}
                        onEdit={setEditingEntry}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <EditEntryModal
        entry={editingEntry}
        open={!!editingEntry}
        onClose={() => setEditingEntry(null)}
        onSaved={() => {
          mutate(`harvest:${selectedDate}:all:all`)
          mutate((key: string) => typeof key === 'string' && key.startsWith('harvest:' + selectedDate), undefined, { revalidate: true })
        }}
      />
    </div>
  )
}

function EntryRow({
  entry,
  currentUserId,
  isAdmin,
  activeDate,
  onDelete,
  onEdit,
}: {
  entry: HarvestEntryWithProduct
  currentUserId: string
  isAdmin: boolean
  activeDate: string
  onDelete: (id: string, palletId?: string | null) => void
  onEdit: (entry: HarvestEntryWithProduct) => void
}) {
  const canModify = isAdmin || (entry.created_by === currentUserId && entry.entry_date === activeDate)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (confirm('确定要删除这条收菜明细记录吗？')) {
      setDeleting(true)
      await onDelete(entry.id, entry.pallet_id)
      setDeleting(false)
    }
  }

  const entryTime = entry.created_at ? formatAucklandTime(entry.created_at) : ''

  return (
    <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-xs slide-in">
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
          {!entry.pallet_id && entry.pallet && <span className="text-[10px] text-gray-300">({entry.pallet})</span>}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {entryTime && (
          <span className="text-[11px] text-gray-400 font-medium bg-gray-50 px-1.5 py-0.5 rounded">
            {entryTime}
          </span>
        )}

        {canModify && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onEdit(entry)}
              className="p-2 rounded-lg text-blue-400 hover:text-blue-600 hover:bg-blue-50 active:scale-95 transition-all"
              aria-label="编辑"
            >
              <Pencil className="w-4 h-4" />
            </button>
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
          </div>
        )}
      </div>
    </div>
  )
}
