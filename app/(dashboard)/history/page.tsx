'use client'

import { useState } from 'react'
import { useHarvestEntries } from '@/hooks/useHarvestEntries'
import { TEAMS, TEAM_COLORS } from '@/lib/constants'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Loader2, Download, CalendarIcon, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { exportHarvestDetail } from '@/lib/export-excel'
import { useDateFilter } from '@/stores/dateFilter'
import { formatAucklandDate, formatAucklandDateLabel, toAucklandCalendarDate } from '@/lib/auckland-time'
import type { HarvestEntryWithProduct, ProductSummary } from '@/lib/types'

export default function HistoryPage() {
  const { selectedDate, setSelectedDate } = useDateFilter()
  const [calOpen, setCalOpen] = useState(false)
  const [activeTeam, setActiveTeam] = useState('all')

  const { data: allEntries = [], isLoading } = useHarvestEntries({ date: selectedDate })
  const { data: entries = [] } = useHarvestEntries({
    date: selectedDate,
    team: activeTeam === 'all' ? undefined : activeTeam,
  })

  const teamTotals = TEAMS.reduce((acc, t) => {
    acc[t] = allEntries.filter(e => e.team === t).reduce((s, e) => s + e.total_qty, 0)
    return acc
  }, {} as Record<string, number>)

  const grandTotal = allEntries.reduce((s, e) => s + e.total_qty, 0)
  const grouped = groupByProduct(entries)

  const displayDate = formatAucklandDateLabel(selectedDate)

  return (
    <div className="space-y-4">
      {/* Date Picker */}
      <Popover open={calOpen} onOpenChange={setCalOpen}>
        <PopoverTrigger
          render={
            <Button variant="outline" className="w-full h-12 text-base justify-between">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-green-600" />
                {displayDate}
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </Button>
          }
        />
        <PopoverContent className="w-auto p-0" align="center">
          <Calendar
            mode="single"
            selected={toAucklandCalendarDate(selectedDate)}
            onSelect={(date) => {
              if (date) {
                setSelectedDate(formatAucklandDate(date))
                setCalOpen(false)
              }
            }}
          />
        </PopoverContent>
      </Popover>

      {/* Total Card */}
      <div className="bg-gradient-to-br from-green-600 to-emerald-700 rounded-2xl p-5 text-white shadow-lg">
        <p className="text-sm font-medium text-green-100">当日全场总收菜量</p>
        <p className="text-5xl font-black mt-1 tracking-tight">{grandTotal}</p>
        <p className="text-xs text-green-200 mt-1">{displayDate}</p>
      </div>

      {/* Team Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
        <button
          onClick={() => setActiveTeam('all')}
          className={cn(
            'flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-150 border-2',
            activeTeam === 'all'
              ? 'bg-white shadow-md border-gray-400 text-gray-600 scale-[1.02]'
              : 'bg-white/50 border-transparent text-gray-500 hover:bg-white',
          )}
        >
          全部 <span className="text-xs px-1.5 py-0.5 rounded-md font-bold bg-gray-100 text-gray-600">{grandTotal}</span>
        </button>
        {TEAMS.filter(t => (teamTotals[t] ?? 0) > 0).map(t => (
          <button
            key={t}
            onClick={() => setActiveTeam(t)}
            className={cn(
              'flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-150 border-2',
              activeTeam === t
                ? 'bg-white shadow-md border-current scale-[1.02]'
                : 'bg-white/50 border-transparent hover:bg-white',
            )}
            style={{ color: activeTeam === t ? TEAM_COLORS[t] : '#6b7280' }}
          >
            {t} <span className="text-xs px-1.5 py-0.5 rounded-md font-bold bg-current/10">{teamTotals[t]}</span>
          </button>
        ))}
      </div>

      {/* Export */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => exportHarvestDetail(entries, selectedDate, activeTeam)} className="text-xs gap-1.5">
          <Download className="w-3.5 h-3.5" />导出 Excel
        </Button>
      </div>

      {/* Product List */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">该日期暂无记录</div>
      ) : (
        <div className="space-y-2">
          {grouped.map(group => <ProductGroup key={group.product_id} group={group} />)}
        </div>
      )}
    </div>
  )
}

function ProductGroup({ group }: { group: ProductSummary }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50"
      >
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
          <span className="text-sm font-medium text-gray-800 truncate">{group.product_name}</span>
        </div>
        <Badge className="flex-shrink-0 ml-2 bg-green-100 text-green-700 hover:bg-green-100 font-bold text-sm px-2.5">{group.total}</Badge>
      </button>
      {expanded && (
        <div className="border-t border-gray-50">
          {group.entries.map(entry => (
            <div key={entry.id} className="flex items-center justify-between px-4 py-2.5 border-b border-gray-50 last:border-0">
              <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500">
                <span className="font-bold px-1.5 py-0.5 rounded text-white text-[11px]" style={{ backgroundColor: TEAM_COLORS[entry.team] }}>{entry.team}</span>
                <span>{entry.crate}</span>
                <span>{entry.greenhouse_no}</span>
                {entry.bag_qty > 0 && <span>Bag×{entry.bag_qty}</span>}
                {entry.loose_qty > 0 && <span>Loose×{entry.loose_qty}</span>}
              </div>
              <span className="text-sm font-bold text-gray-800 ml-2 flex-shrink-0">{entry.total_qty}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function groupByProduct(entries: HarvestEntryWithProduct[]): ProductSummary[] {
  const map = new Map<string, ProductSummary>()
  for (const entry of entries) {
    const key = entry.product_id
    const name = entry.product?.factory_product_name ?? entry.product_id
    if (!map.has(key)) map.set(key, { product_id: key, product_name: name, total: 0, entries: [] })
    const g = map.get(key)!
    g.total += entry.total_qty
    g.entries.push(entry)
  }
  return Array.from(map.values()).sort((a, b) => a.product_name.localeCompare(b.product_name))
}
