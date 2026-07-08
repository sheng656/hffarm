'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { useHarvestEntries } from '@/hooks/useHarvestEntries'
import { AREA_CATEGORIES, AREA_LABELS } from '@/lib/constants'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Loader2, Download, CalendarIcon, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { exportAreaDetail } from '@/lib/export-excel'
import { useDateFilter } from '@/stores/dateFilter'
import type { HarvestEntryWithProduct } from '@/lib/types'

export default function AreaPage() {
  const { selectedDate, setSelectedDate } = useDateFilter()
  const [calOpen, setCalOpen] = useState(false)
  const [activeArea, setActiveArea] = useState('all')

  const { data: allEntries = [], isLoading } = useHarvestEntries({ date: selectedDate })
  const entries = activeArea === 'all'
    ? allEntries
    : allEntries.filter(e => e.area_category === activeArea)

  const areaTotals = AREA_CATEGORIES.reduce((acc, a) => {
    acc[a] = allEntries.filter(e => e.area_category === a).reduce((s, e) => s + e.total_qty, 0)
    return acc
  }, {} as Record<string, number>)
  const grandTotal = allEntries.reduce((s, e) => s + e.total_qty, 0)

  // Group by product name within active area
  const grouped = groupByProduct(entries)

  return (
    <div className="space-y-4">
      {/* Date Picker */}
      <Popover open={calOpen} onOpenChange={setCalOpen}>
        <PopoverTrigger
          render={
            <Button variant="outline" className="w-full h-12 text-base justify-between">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-green-600" />
                {format(new Date(selectedDate + 'T12:00:00'), 'yyyy年MM月dd日')}
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </Button>
          }
        />
        <PopoverContent className="w-auto p-0" align="center">
          <Calendar
            mode="single"
            selected={new Date(selectedDate + 'T12:00:00')}
            onSelect={date => { if (date) { setSelectedDate(format(date, 'yyyy-MM-dd')); setCalOpen(false) } }}
          />
        </PopoverContent>
      </Popover>

      {/* Area Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
        <button
          onClick={() => setActiveArea('all')}
          className={cn(
            'flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border-2 transition-all',
            activeArea === 'all' ? 'bg-green-600 text-white border-green-600 shadow-md' : 'bg-white border-gray-200 text-gray-500',
          )}
        >
          全部 <span className="text-xs px-1.5 py-0.5 rounded-md bg-white/20 font-bold">{grandTotal}</span>
        </button>
        {AREA_CATEGORIES.filter(a => (areaTotals[a] ?? 0) > 0).map(a => (
          <button
            key={a}
            onClick={() => setActiveArea(a)}
            className={cn(
              'flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border-2 transition-all whitespace-nowrap',
              activeArea === a ? 'bg-green-600 text-white border-green-600 shadow-md' : 'bg-white border-gray-200 text-gray-600 hover:border-green-300',
            )}
          >
            {AREA_LABELS[a] ?? a}
            <span className={cn('text-xs px-1.5 py-0.5 rounded-md font-bold', activeArea === a ? 'bg-white/20' : 'bg-gray-100')}>
              {areaTotals[a]}
            </span>
          </button>
        ))}
      </div>

      {/* Export */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => exportAreaDetail(entries, selectedDate, activeArea)} className="text-xs gap-1.5">
          <Download className="w-3.5 h-3.5" />导出 Excel
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">该日期暂无数据</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-0 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <span>产品</span>
            <span className="text-right w-16">Bag</span>
            <span className="text-right w-16">Loose</span>
            <span className="text-right w-16">总数</span>
          </div>
          {grouped.map(({ product_name, bag, loose, total, entries: es }) => (
            <div key={product_name}>
              {/* Product row */}
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-0 px-4 py-2.5 border-b border-gray-50 bg-green-50/40">
                <span className="text-sm font-semibold text-gray-800 truncate">{product_name}</span>
                <span className="text-sm text-right w-16 text-gray-600">{bag || '—'}</span>
                <span className="text-sm text-right w-16 text-gray-600">{loose || '—'}</span>
                <span className="text-sm font-bold text-right w-16 text-green-700">{total}</span>
              </div>
              {/* Sub rows */}
              {es.map(e => (
                <div key={e.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-0 px-4 py-2 border-b border-gray-50 last:border-0">
                  <div className="text-xs text-gray-400 truncate">{e.greenhouse_no} · {e.crate}</div>
                  <span className="text-xs text-right w-16 text-gray-500">{e.bag_qty || '—'}</span>
                  <span className="text-xs text-right w-16 text-gray-500">{e.loose_qty || '—'}</span>
                  <span className="text-xs font-medium text-right w-16 text-gray-700">{e.total_qty}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function groupByProduct(entries: HarvestEntryWithProduct[]) {
  const map = new Map<string, { product_name: string; bag: number; loose: number; total: number; entries: HarvestEntryWithProduct[] }>()
  for (const e of entries) {
    const name = e.product?.factory_product_name ?? e.product_id
    if (!map.has(name)) map.set(name, { product_name: name, bag: 0, loose: 0, total: 0, entries: [] })
    const g = map.get(name)!
    g.bag += e.bag_qty
    g.loose += e.loose_qty
    g.total += e.total_qty
    g.entries.push(e)
  }
  return Array.from(map.values()).sort((a, b) => a.product_name.localeCompare(b.product_name))
}
