'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatAucklandDate, formatAucklandDateLabel } from '@/lib/auckland-time'
import { useHarvestEntries } from '@/hooks/useHarvestEntries'
import { useStatsData } from '@/hooks/useStatsData'
import { useUser } from '@/hooks/useUser'
import { TEAMS, TEAM_COLORS } from '@/lib/constants'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, Download, ChevronDown, ChevronRight, Plus, ChevronRight as ArrowRightIcon, LayoutGrid, FileSpreadsheet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { exportHarvestDetail } from '@/lib/export-excel'
import { ExcelDetailTable } from '@/components/forms/ExcelDetailTable'
import type { HarvestEntryWithProduct, ProductSummary } from '@/lib/types'

const TODAY = formatAucklandDate()

export default function TodayPage() {
  const { isEditor } = useUser()
  const [activeTeam, setActiveTeam] = useState('all')
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')
  const { data: entries = [], isLoading } = useHarvestEntries({
    date: TODAY,
    team: activeTeam === 'all' ? undefined : activeTeam,
  })
  const { data: allEntries = [] } = useHarvestEntries({ date: TODAY })
  const { totalPallets, hasOldData } = useStatsData({ date: TODAY })

  // Total per team (from allEntries)
  const teamTotals = TEAMS.reduce((acc, t) => {
    acc[t] = allEntries.filter(e => e.team === t).reduce((s, e) => s + e.total_qty, 0)
    return acc
  }, {} as Record<string, number>)

  const grandTotal = allEntries.reduce((s, e) => s + e.total_qty, 0)

  // Group by product
  const grouped = groupByProduct(entries)

  return (
    <div className="space-y-4">
      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-gradient-to-br from-green-600 to-emerald-700 rounded-2xl p-4 text-white shadow-md flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-semibold text-green-100 uppercase tracking-wider">今日总产量</p>
            <p className="text-2xl font-black mt-1 tracking-tight">{grandTotal}</p>
          </div>
          <p className="text-[9px] text-green-200 mt-2 truncate">{formatAucklandDateLabel()}</p>
        </div>

        <Link
          href={`/stats?date=${TODAY}`}
          className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-green-200 transition-all flex flex-col justify-between group active:scale-[0.98]"
        >
          <div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider group-hover:text-green-600 transition-colors">今日使用板数</p>
              <ArrowRightIcon className="w-3 h-3 text-gray-300 group-hover:text-green-600 transition-colors" />
            </div>
            <p className="text-2xl font-black mt-1 text-gray-800 tracking-tight">{totalPallets}</p>
          </div>
          <p className="text-[9px] text-gray-400 mt-2 truncate group-hover:text-green-600 transition-colors">
            {hasOldData ? '*含旧录入数据' : '查看板型统计 >'}
          </p>
        </Link>

        <Link
          href={`/stats?date=${TODAY}`}
          className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all flex flex-col justify-between group active:scale-[0.98]"
        >
          <div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider group-hover:text-emerald-600 transition-colors">今日使用筐数</p>
              <ArrowRightIcon className="w-3 h-3 text-gray-300 group-hover:text-emerald-600 transition-colors" />
            </div>
            <p className="text-2xl font-black mt-1 text-gray-800 tracking-tight">{grandTotal}</p>
          </div>
          <p className="text-[9px] text-gray-400 mt-2 truncate group-hover:text-emerald-600 transition-colors">
            查看箱型分布 &gt;
          </p>
        </Link>
      </div>

      {/* Team Tabs (Only in Cards Mode) */}
      {viewMode === 'cards' && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
          <TeamTab
            label="全部"
            total={grandTotal}
            active={activeTeam === 'all'}
            color="#6b7280"
            onClick={() => setActiveTeam('all')}
          />
          {TEAMS.filter(t => (teamTotals[t] ?? 0) > 0).map(t => (
            <TeamTab
              key={t}
              label={t}
              total={teamTotals[t] ?? 0}
              active={activeTeam === t}
              color={TEAM_COLORS[t]}
              onClick={() => setActiveTeam(t)}
            />
          ))}
        </div>
      )}

      {/* Control Toolbar: View Toggle & Register & Export Buttons */}
      <div className="flex items-center justify-between gap-2">
        {/* Mode Switcher */}
        <div className="flex items-center p-1 bg-gray-100/90 rounded-xl text-xs font-bold text-gray-600 shrink-0 border border-gray-200/60">
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={cn(
              'px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5',
              viewMode === 'cards' ? 'bg-white text-green-700 shadow-xs font-bold' : 'text-gray-500 hover:text-gray-900'
            )}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            卡片视图
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={cn(
              'px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5',
              viewMode === 'table' ? 'bg-white text-green-700 shadow-xs font-bold' : 'text-gray-500 hover:text-gray-900'
            )}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Excel大表
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/register">
            <Button variant="default" size="sm" className="text-xs gap-1.5 bg-green-600 hover:bg-green-700 font-bold shadow-xs">
              <Plus className="w-3.5 h-3.5" />
              去录入
            </Button>
          </Link>
          {viewMode === 'cards' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportHarvestDetail(entries, TODAY, activeTeam)}
              className="text-xs gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              导出
            </Button>
          )}
        </div>
      </div>

      {/* Content Rendering: Table Mode vs Cards Mode */}
      {viewMode === 'table' ? (
        <ExcelDetailTable entries={allEntries} isLoading={isLoading} date={TODAY} />
      ) : (
        /* Entries grouped by product */
        isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
          </div>
        ) : grouped.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">今日暂无记录</div>
        ) : (
          <div className="space-y-2">
            {grouped.map(group => (
              <ProductGroup key={group.product_id + group.product_name} group={group} />
            ))}
          </div>
        )
      )}

      {/* Floating Action Button for Mobile / Quick Access */}
      {isEditor && (
        <Link
          href="/register"
          className="fixed bottom-20 right-4 z-40 flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-green-600 text-white shadow-lg hover:bg-green-700 active:scale-95 transition-all text-sm font-bold border border-green-500/30"
        >
          <Plus className="w-4 h-4" />
          去录入
        </Link>
      )}
    </div>
  )
}

function TeamTab({ label, total, active, color, onClick }: {
  label: string; total: number; active: boolean; color: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-150 border-2',
        active
          ? 'bg-white shadow-md border-current scale-[1.02]'
          : 'bg-white/50 border-transparent hover:bg-white hover:border-gray-200',
      )}
      style={{ color: active ? color : '#6b7280' }}
    >
      <span>{label}</span>
      <span className={cn(
        'text-xs px-1.5 py-0.5 rounded-md font-bold',
        active ? 'bg-current/10' : 'bg-gray-100 text-gray-600',
      )}>
        {total}
      </span>
    </button>
  )
}

function ProductGroup({ group }: { group: ProductSummary }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0 text-left">
          {expanded
            ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
            : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          }
          <span className="text-sm font-medium text-gray-800 truncate">{group.product_name}</span>
        </div>
        <Badge className="flex-shrink-0 ml-2 bg-green-100 text-green-700 hover:bg-green-100 font-bold text-sm px-2.5">
          {group.total}
        </Badge>
      </button>

      {expanded && (
        <div className="border-t border-gray-50">
          {group.entries.map(entry => (
            <div key={entry.id} className="flex items-center justify-between px-4 py-2.5 border-b border-gray-50 last:border-0">
              <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500">
                <span
                  className="font-bold px-1.5 py-0.5 rounded text-white text-[11px]"
                  style={{ backgroundColor: TEAM_COLORS[entry.team] }}
                >
                  {entry.team}
                </span>
                <span>{entry.crate}</span>
                <span>{entry.pallet}</span>
                <span className="text-gray-400">{entry.greenhouse_no}</span>
                {entry.bag_qty > 0 && <span>Bag×{entry.bag_qty}</span>}
                {entry.loose_qty > 0 && <span>Loose×{entry.loose_qty}</span>}
                {entry.notes && <span className="text-amber-600">📝 {entry.notes}</span>}
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
    if (!map.has(key)) {
      map.set(key, { product_id: key, product_name: name, total: 0, entries: [] })
    }
    const group = map.get(key)!
    group.total += entry.total_qty
    group.entries.push(entry)
  }
  return Array.from(map.values()).sort((a, b) => a.product_name.localeCompare(b.product_name))
}
