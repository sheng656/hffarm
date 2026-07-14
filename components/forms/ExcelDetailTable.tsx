'use client'

import { useState, useMemo } from 'react'
import { TEAM_COLORS } from '@/lib/constants'
import { formatAucklandTime } from '@/lib/auckland-time'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { exportHarvestDetail } from '@/lib/export-excel'
import {
  Search,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Layers,
  Filter,
  PackageCheck,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { HarvestEntryWithProduct } from '@/lib/types'

export type GroupMode = 'team-product' | 'product-team' | 'flat'
export type SortField = 'total_qty' | 'product_name' | 'team' | 'created_at' | 'greenhouse_no' | 'crate'

interface ExcelDetailTableProps {
  entries: HarvestEntryWithProduct[]
  isLoading?: boolean
  date?: string
}

export function ExcelDetailTable({ entries, isLoading, date }: ExcelDetailTableProps) {
  const [search, setSearch] = useState('')
  const [selectedTeam, setSelectedTeam] = useState<string>('all')
  const [selectedCrate, setSelectedCrate] = useState<string>('all')
  const [groupMode, setGroupMode] = useState<GroupMode>('flat')
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortAsc, setSortAsc] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})

  // Distinct list of crates from entries for quick filter dropdown
  const availableCrates = useMemo(() => {
    const set = new Set(entries.map(e => e.crate).filter(Boolean))
    return Array.from(set).sort()
  }, [entries])

  // Filter entries
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      // Team filter
      if (selectedTeam !== 'all' && e.team !== selectedTeam) return false
      // Crate filter
      if (selectedCrate !== 'all' && e.crate !== selectedCrate) return false

      // Search text filter
      if (search.trim()) {
        const q = search.toLowerCase().trim()
        const pName = (e.product?.factory_product_name ?? e.product_id).toLowerCase()
        const sCode = (e.product?.stockcode ?? '').toLowerCase()
        const gh = (e.greenhouse_no ?? '').toLowerCase()
        const notes = (e.notes ?? '').toLowerCase()
        const crate = (e.crate ?? '').toLowerCase()
        const pallet = (e.pallet ?? '').toLowerCase()
        const creator = (e.created_by_email ?? '').toLowerCase()

        return (
          pName.includes(q) ||
          sCode.includes(q) ||
          gh.includes(q) ||
          notes.includes(q) ||
          crate.includes(q) ||
          pallet.includes(q) ||
          creator.includes(q)
        )
      }

      return true
    })
  }, [entries, selectedTeam, selectedCrate, search])

  // Sorted entries for 'flat' mode
  const sortedEntries = useMemo(() => {
    const list = [...filteredEntries]
    list.sort((a, b) => {
      let valA: any
      let valB: any
      if (sortField === 'total_qty') {
        valA = a.total_qty || 0
        valB = b.total_qty || 0
      } else if (sortField === 'product_name') {
        valA = a.product?.factory_product_name ?? a.product_id
        valB = b.product?.factory_product_name ?? b.product_id
      } else if (sortField === 'team') {
        valA = a.team ?? ''
        valB = b.team ?? ''
      } else if (sortField === 'greenhouse_no') {
        valA = a.greenhouse_no ?? ''
        valB = b.greenhouse_no ?? ''
      } else if (sortField === 'crate') {
        valA = a.crate ?? ''
        valB = b.crate ?? ''
      } else {
        valA = a.created_at ?? ''
        valB = b.created_at ?? ''
      }

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortAsc ? valA - valB : valB - valA
      }
      return sortAsc
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA))
    })
    return list
  }, [filteredEntries, sortField, sortAsc])

  // Hierarchical Groupings
  const teamProductGroups = useMemo(() => {
    if (groupMode !== 'team-product') return []

    // Group by Team -> Product
    const teamMap = new Map<string, Map<string, HarvestEntryWithProduct[]>>()

    filteredEntries.forEach(entry => {
      const teamKey = entry.team || '未分类'
      const prodKey = entry.product?.factory_product_name ?? entry.product_id

      if (!teamMap.has(teamKey)) {
        teamMap.set(teamKey, new Map())
      }
      const prodMap = teamMap.get(teamKey)!
      if (!prodMap.has(prodKey)) {
        prodMap.set(prodKey, [])
      }
      prodMap.get(prodKey)!.push(entry)
    })

    // Convert to structured array
    const result = Array.from(teamMap.entries()).map(([teamName, prodMap]) => {
      let teamTotalBag = 0
      let teamTotalLoose = 0
      let teamTotalQty = 0

      const products = Array.from(prodMap.entries()).map(([prodName, items]) => {
        let pBag = 0
        let pLoose = 0
        let pTotal = 0
        items.forEach(i => {
          pBag += i.bag_qty || 0
          pLoose += i.loose_qty || 0
          pTotal += i.total_qty || 0
        })
        teamTotalBag += pBag
        teamTotalLoose += pLoose
        teamTotalQty += pTotal
        return {
          prodName,
          items,
          pBag,
          pLoose,
          pTotal,
        }
      }).sort((a, b) => a.prodName.localeCompare(b.prodName))

      return {
        teamName,
        products,
        teamTotalBag,
        teamTotalLoose,
        teamTotalQty,
      }
    }).sort((a, b) => a.teamName.localeCompare(b.teamName))

    return result
  }, [filteredEntries, groupMode])

  const productTeamGroups = useMemo(() => {
    if (groupMode !== 'product-team') return []

    const prodMap = new Map<string, HarvestEntryWithProduct[]>()
    filteredEntries.forEach(entry => {
      const prodKey = entry.product?.factory_product_name ?? entry.product_id
      if (!prodMap.has(prodKey)) prodMap.set(prodKey, [])
      prodMap.get(prodKey)!.push(entry)
    })

    return Array.from(prodMap.entries()).map(([prodName, items]) => {
      let pBag = 0
      let pLoose = 0
      let pTotal = 0
      items.forEach(i => {
        pBag += i.bag_qty || 0
        pLoose += i.loose_qty || 0
        pTotal += i.total_qty || 0
      })
      return {
        prodName,
        items,
        pBag,
        pLoose,
        pTotal,
      }
    }).sort((a, b) => a.prodName.localeCompare(b.prodName))
  }, [filteredEntries, groupMode])

  // Overall Totals
  const totals = useMemo(() => {
    let grandBag = 0
    let grandLoose = 0
    let grandTotal = 0

    filteredEntries.forEach(e => {
      grandBag += e.bag_qty || 0
      grandLoose += e.loose_qty || 0
      grandTotal += e.total_qty || 0
    })

    return { grandBag, grandLoose, grandTotal, count: filteredEntries.length }
  }, [filteredEntries])

  // Toggle group collapse
  const toggleCollapse = (groupKey: string) => {
    setCollapsedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }))
  }

  // Table header click sorting for flat mode
  const handleSortClick = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortField(field)
      setSortAsc(false) // default desc for quantities
    }
  }

  return (
    <div className="space-y-3">
      {/* Search & Filter Toolbar */}
      <div className="bg-white p-3 rounded-2xl border border-gray-200/80 shadow-xs space-y-2.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索产品、大棚、箱型、板型、备注..."
              className="pl-9 text-xs h-9 rounded-xl border-gray-200 bg-gray-50/50 focus:bg-white"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Grouping Mode Switcher */}
          <div className="flex items-center p-0.5 bg-gray-100 rounded-xl text-xs font-semibold shrink-0">
            <button
              type="button"
              onClick={() => setGroupMode('team-product')}
              className={cn(
                'px-2.5 py-1.5 rounded-lg transition-all',
                groupMode === 'team-product' ? 'bg-white text-green-700 shadow-xs font-bold' : 'text-gray-500 hover:text-gray-800'
              )}
            >
              按团队
            </button>
            <button
              type="button"
              onClick={() => setGroupMode('product-team')}
              className={cn(
                'px-2.5 py-1.5 rounded-lg transition-all',
                groupMode === 'product-team' ? 'bg-white text-green-700 shadow-xs font-bold' : 'text-gray-500 hover:text-gray-800'
              )}
            >
              按产品
            </button>
            <button
              type="button"
              onClick={() => setGroupMode('flat')}
              className={cn(
                'px-2.5 py-1.5 rounded-lg transition-all',
                groupMode === 'flat' ? 'bg-white text-green-700 shadow-xs font-bold' : 'text-gray-500 hover:text-gray-800'
              )}
            >
              平铺全量表
            </button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
          <div className="flex items-center gap-1 shrink-0 text-gray-500 font-semibold">
            <Filter className="w-3.5 h-3.5" />
            <span>团队:</span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedTeam('all')}
            className={cn(
              'px-2.5 py-1 rounded-lg font-semibold shrink-0 border transition-all',
              selectedTeam === 'all'
                ? 'bg-gray-800 text-white border-gray-800'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            )}
          >
            全部
          </button>
          {['H', 'J', 'M', 'S', 'W', 'Y'].map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setSelectedTeam(t)}
              className={cn(
                'px-2.5 py-1 rounded-lg font-bold shrink-0 border transition-all',
                selectedTeam === t
                  ? 'text-white border-transparent shadow-xs'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
              )}
              style={selectedTeam === t ? { backgroundColor: TEAM_COLORS[t] } : {}}
            >
              {t} 团队
            </button>
          ))}

          {availableCrates.length > 0 && (
            <>
              <span className="text-gray-300">|</span>
              <div className="flex items-center gap-1 shrink-0 text-gray-500 font-semibold">
                <span>箱型:</span>
              </div>
              <select
                value={selectedCrate}
                onChange={e => setSelectedCrate(e.target.value)}
                className="h-7 px-2 text-xs rounded-lg border border-gray-200 bg-white font-semibold text-gray-700"
              >
                <option value="all">全部箱型</option>
                {availableCrates.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>

      {/* Main Excel-styled Data Table Container */}
      <div className="bg-white border border-emerald-200/70 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            {/* Table Header */}
            <thead>
              <tr className="bg-emerald-50/90 border-b border-emerald-200/80 text-emerald-950 font-bold select-none sticky top-0 z-10 backdrop-blur-xs">
                <th className="py-2.5 px-3 w-10 text-center border-r border-emerald-200/60">#</th>
                <th
                  onClick={() => handleSortClick('team')}
                  className="py-2.5 px-3 w-16 cursor-pointer hover:bg-emerald-100/60 border-r border-emerald-200/60"
                >
                  <div className="flex items-center gap-1">
                    <span>团队</span>
                    {sortField === 'team' && (sortAsc ? <ArrowUp className="w-3 h-3 text-emerald-700" /> : <ArrowDown className="w-3 h-3 text-emerald-700" />)}
                  </div>
                </th>
                <th
                  onClick={() => handleSortClick('product_name')}
                  className="py-2.5 px-3 min-w-[140px] cursor-pointer hover:bg-emerald-100/60 border-r border-emerald-200/60"
                >
                  <div className="flex items-center gap-1">
                    <span>产品名称</span>
                    {sortField === 'product_name' && (sortAsc ? <ArrowUp className="w-3 h-3 text-emerald-700" /> : <ArrowDown className="w-3 h-3 text-emerald-700" />)}
                  </div>
                </th>
                <th
                  onClick={() => handleSortClick('greenhouse_no')}
                  className="py-2.5 px-3 min-w-[90px] cursor-pointer hover:bg-emerald-100/60 border-r border-emerald-200/60"
                >
                  <div className="flex items-center gap-1">
                    <span>大棚</span>
                    {sortField === 'greenhouse_no' && (sortAsc ? <ArrowUp className="w-3 h-3 text-emerald-700" /> : <ArrowDown className="w-3 h-3 text-emerald-700" />)}
                  </div>
                </th>
                <th
                  onClick={() => handleSortClick('crate')}
                  className="py-2.5 px-3 min-w-[80px] cursor-pointer hover:bg-emerald-100/60 border-r border-emerald-200/60"
                >
                  <div className="flex items-center gap-1">
                    <span>箱型</span>
                    {sortField === 'crate' && (sortAsc ? <ArrowUp className="w-3 h-3 text-emerald-700" /> : <ArrowDown className="w-3 h-3 text-emerald-700" />)}
                  </div>
                </th>
                <th className="py-2.5 px-3 min-w-[70px] border-r border-emerald-200/60">板型</th>
                <th className="py-2.5 px-3 w-16 text-right border-r border-emerald-200/60">包数</th>
                <th className="py-2.5 px-3 w-16 text-right border-r border-emerald-200/60">散数</th>
                <th
                  onClick={() => handleSortClick('total_qty')}
                  className="py-2.5 px-3 w-20 text-right cursor-pointer hover:bg-emerald-100/60 border-r border-emerald-200/60 bg-emerald-100/50 text-emerald-900 font-extrabold"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>总筐数</span>
                    {sortField === 'total_qty' ? (
                      sortAsc ? <ArrowUp className="w-3 h-3 text-emerald-700" /> : <ArrowDown className="w-3 h-3 text-emerald-700" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-emerald-600 opacity-60" />
                    )}
                  </div>
                </th>
                <th className="py-2.5 px-3 min-w-[120px] border-r border-emerald-200/60">备注</th>
                <th
                  onClick={() => handleSortClick('created_at')}
                  className="py-2.5 px-3 min-w-[90px] cursor-pointer hover:bg-emerald-100/60"
                >
                  <div className="flex items-center gap-1">
                    <span>录入时间</span>
                    {sortField === 'created_at' && (sortAsc ? <ArrowUp className="w-3 h-3 text-emerald-700" /> : <ArrowDown className="w-3 h-3 text-emerald-700" />)}
                  </div>
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-gray-400">
                    数据加载中...
                  </td>
                </tr>
              ) : filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-gray-400">
                    暂无符合条件的收菜记录
                  </td>
                </tr>
              ) : groupMode === 'team-product' ? (
                /* Group Mode 1: Team -> Product */
                teamProductGroups.map((group) => {
                  const teamCollapsed = !!collapsedGroups[`team_${group.teamName}`]
                  const teamColor = TEAM_COLORS[group.teamName] || '#4b5563'

                  return (
                    <tbody key={group.teamName} className="border-b-2 border-emerald-100">
                      {/* Team Group Header Row */}
                      <tr
                        onClick={() => toggleCollapse(`team_${group.teamName}`)}
                        className="bg-emerald-100/70 hover:bg-emerald-100 text-emerald-950 font-bold border-b border-emerald-200/80 cursor-pointer transition-colors select-none"
                      >
                        <td colSpan={6} className="py-2.5 px-3 border-r border-emerald-200/60">
                          <div className="flex items-center gap-2">
                            {teamCollapsed ? <ChevronRight className="w-4 h-4 text-emerald-700" /> : <ChevronDown className="w-4 h-4 text-emerald-700" />}
                            <span
                              className="px-2.5 py-0.5 rounded-lg font-black text-xs text-white shadow-2xs"
                              style={{ backgroundColor: teamColor }}
                            >
                              {group.teamName} 团队
                            </span>
                            <span className="text-emerald-800 text-[11px] font-semibold">
                              ({group.products.length} 个产品)
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-900 border-r border-emerald-200/60">
                          {group.teamTotalBag || ''}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-900 border-r border-emerald-200/60">
                          {group.teamTotalLoose || ''}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-emerald-950 text-sm border-r border-emerald-200/60 bg-emerald-200/40">
                          {group.teamTotalQty} 筐
                        </td>
                        <td colSpan={2} className="py-2.5 px-3 text-[11px] text-emerald-700 font-medium">
                          团队合计
                        </td>
                      </tr>

                      {/* Product Groups inside Team */}
                      {!teamCollapsed && group.products.map(prod => {
                        const prodKey = `prod_${group.teamName}_${prod.prodName}`
                        const prodCollapsed = !!collapsedGroups[prodKey]

                        return (
                          <template key={prod.prodName}>
                            {/* Product SubHeader Row */}
                            <tr
                              onClick={() => toggleCollapse(prodKey)}
                              className="bg-emerald-50/40 hover:bg-emerald-100/50 border-b border-emerald-100 font-bold text-emerald-900 cursor-pointer select-none"
                            >
                              <td colSpan={6} className="py-1.5 px-3 pl-6 border-r border-emerald-100">
                                <div className="flex items-center gap-1.5">
                                  {prodCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                                  <span className="font-bold text-gray-900">{prod.prodName}</span>
                                  <span className="text-[11px] font-medium text-emerald-700">
                                    ({prod.items.length} 条记录)
                                  </span>
                                </div>
                              </td>
                              <td className="py-1.5 px-3 text-right text-gray-700 border-r border-emerald-100 font-bold">
                                {prod.pBag || ''}
                              </td>
                              <td className="py-1.5 px-3 text-right text-gray-700 border-r border-emerald-100 font-bold">
                                {prod.pLoose || ''}
                              </td>
                              <td className="py-1.5 px-3 text-right font-black text-emerald-800 border-r border-emerald-100 bg-emerald-100/60">
                                {prod.pTotal}
                              </td>
                              <td colSpan={2} className="py-1.5 px-3 text-[10px] text-gray-400 font-normal">
                                产品小计
                              </td>
                            </tr>

                            {/* Detail Rows under Product */}
                            {!prodCollapsed && prod.items.map((entry, rowIdx) => (
                              <tr
                                key={entry.id}
                                className="hover:bg-green-50/30 border-b border-gray-100 transition-colors text-gray-700"
                              >
                                <td className="py-2 px-3 text-center text-gray-400 font-mono text-[11px] border-r border-gray-100">
                                  {rowIdx + 1}
                                </td>
                                <td className="py-2 px-3 border-r border-gray-100 font-bold">
                                  <span
                                    className="px-1.5 py-0.5 rounded text-white text-[10px]"
                                    style={{ backgroundColor: teamColor }}
                                  >
                                    {entry.team}
                                  </span>
                                </td>
                                <td className="py-2 px-3 border-r border-gray-100 font-medium text-gray-900 pl-8">
                                  {entry.product?.factory_product_name}
                                </td>
                                <td className="py-2 px-3 border-r border-gray-100">
                                  <span className="bg-emerald-50 text-emerald-800 border border-emerald-100/60 px-1.5 py-0.5 rounded font-mono font-semibold">
                                    {entry.greenhouse_no}
                                  </span>
                                </td>
                                <td className="py-2 px-3 border-r border-gray-100 font-semibold text-gray-800">
                                  {entry.crate}
                                </td>
                                <td className="py-2 px-3 border-r border-gray-100 text-gray-600">
                                  {entry.pallet}
                                </td>
                                <td className="py-2 px-3 text-right border-r border-gray-100 font-mono">
                                  {entry.bag_qty || '-'}
                                </td>
                                <td className="py-2 px-3 text-right border-r border-gray-100 font-mono">
                                  {entry.loose_qty || '-'}
                                </td>
                                <td className="py-2 px-3 text-right font-black text-emerald-900 border-r border-gray-100 bg-emerald-50/40">
                                  {entry.total_qty}
                                </td>
                                <td className="py-2 px-3 border-r border-gray-100 text-amber-700 truncate max-w-[150px]">
                                  {entry.notes ? `📝 ${entry.notes}` : ''}
                                </td>
                                <td className="py-2 px-3 text-gray-400 text-[11px] font-mono whitespace-nowrap">
                                  {formatAucklandTime(entry.created_at)}
                                </td>
                              </tr>
                            ))}
                          </template>
                        )
                      })}
                    </tbody>
                  )
                })
              ) : groupMode === 'product-team' ? (
                /* Group Mode 2: Product -> Team */
                productTeamGroups.map(group => {
                  const prodCollapsed = !!collapsedGroups[`prod_${group.prodName}`]

                  return (
                    <tbody key={group.prodName} className="border-b-2 border-emerald-100">
                      <tr
                        onClick={() => toggleCollapse(`prod_${group.prodName}`)}
                        className="bg-teal-100/80 hover:bg-teal-100 text-teal-950 font-bold border-b border-teal-200 cursor-pointer transition-colors select-none"
                      >
                        <td colSpan={6} className="py-2.5 px-3 border-r border-teal-200">
                          <div className="flex items-center gap-2">
                            {prodCollapsed ? <ChevronRight className="w-4 h-4 text-teal-700" /> : <ChevronDown className="w-4 h-4 text-teal-700" />}
                            <span className="font-extrabold text-sm text-teal-950">{group.prodName}</span>
                            <span className="text-teal-800 text-[11px] font-medium">
                              ({group.items.length} 条记录)
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-teal-900 border-r border-teal-200">
                          {group.pBag || ''}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-teal-900 border-r border-teal-200">
                          {group.pLoose || ''}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-teal-950 text-sm border-r border-teal-200 bg-teal-200/50">
                          {group.pTotal} 筐
                        </td>
                        <td colSpan={2} className="py-2.5 px-3 text-[11px] text-teal-700">
                          产品合计
                        </td>
                      </tr>

                      {!prodCollapsed && group.items.map((entry, rowIdx) => (
                        <tr
                          key={entry.id}
                          className="hover:bg-gray-50 border-b border-gray-100 transition-colors text-gray-700"
                        >
                          <td className="py-2 px-3 text-center text-gray-400 font-mono text-[11px] border-r border-gray-100">
                            {rowIdx + 1}
                          </td>
                          <td className="py-2 px-3 border-r border-gray-100 font-bold">
                            <span
                              className="px-1.5 py-0.5 rounded text-white text-[10px]"
                              style={{ backgroundColor: TEAM_COLORS[entry.team] || '#4b5563' }}
                            >
                              {entry.team}
                            </span>
                          </td>
                          <td className="py-2 px-3 border-r border-gray-100 font-medium text-gray-900 pl-4">
                            {entry.product?.factory_product_name}
                          </td>
                          <td className="py-2 px-3 border-r border-gray-100">
                            <span className="bg-gray-100 px-1.5 py-0.5 rounded font-mono font-semibold text-gray-700">
                              {entry.greenhouse_no}
                            </span>
                          </td>
                          <td className="py-2 px-3 border-r border-gray-100 font-semibold text-gray-800">
                            {entry.crate}
                          </td>
                          <td className="py-2 px-3 border-r border-gray-100 text-gray-600">
                            {entry.pallet}
                          </td>
                          <td className="py-2 px-3 text-right border-r border-gray-100 font-mono">
                            {entry.bag_qty || '-'}
                          </td>
                          <td className="py-2 px-3 text-right border-r border-gray-100 font-mono">
                            {entry.loose_qty || '-'}
                          </td>
                          <td className="py-2 px-3 text-right font-black text-gray-900 border-r border-gray-100 bg-green-50/30">
                            {entry.total_qty}
                          </td>
                          <td className="py-2 px-3 border-r border-gray-100 text-amber-700 truncate max-w-[150px]">
                            {entry.notes ? `📝 ${entry.notes}` : ''}
                          </td>
                          <td className="py-2 px-3 text-gray-400 text-[11px] font-mono whitespace-nowrap">
                            {formatAucklandTime(entry.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  )
                })
              ) : (
                /* Group Mode 3: Flat Sorted List */
                sortedEntries.map((entry, idx) => (
                  <tr
                    key={entry.id}
                    className="hover:bg-green-50/40 border-b border-gray-100 transition-colors text-gray-700"
                  >
                    <td className="py-2 px-3 text-center text-gray-400 font-mono text-[11px] border-r border-gray-100">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-3 border-r border-gray-100 font-bold">
                      <span
                        className="px-1.5 py-0.5 rounded text-white text-[10px]"
                        style={{ backgroundColor: TEAM_COLORS[entry.team] || '#4b5563' }}
                      >
                        {entry.team}
                      </span>
                    </td>
                    <td className="py-2 px-3 border-r border-gray-100 font-semibold text-gray-900">
                      {entry.product?.factory_product_name}
                    </td>
                    <td className="py-2 px-3 border-r border-gray-100">
                      <span className="bg-gray-100 px-1.5 py-0.5 rounded font-mono font-semibold text-gray-700">
                        {entry.greenhouse_no}
                      </span>
                    </td>
                    <td className="py-2 px-3 border-r border-gray-100 font-semibold text-gray-800">
                      {entry.crate}
                    </td>
                    <td className="py-2 px-3 border-r border-gray-100 text-gray-600">
                      {entry.pallet}
                    </td>
                    <td className="py-2 px-3 text-right border-r border-gray-100 font-mono">
                      {entry.bag_qty || '-'}
                    </td>
                    <td className="py-2 px-3 text-right border-r border-gray-100 font-mono">
                      {entry.loose_qty || '-'}
                    </td>
                    <td className="py-2 px-3 text-right font-black text-gray-900 border-r border-gray-100 bg-green-50/50">
                      {entry.total_qty}
                    </td>
                    <td className="py-2 px-3 border-r border-gray-100 text-amber-700 truncate max-w-[150px]">
                      {entry.notes ? `📝 ${entry.notes}` : ''}
                    </td>
                    <td className="py-2 px-3 text-gray-400 text-[11px] font-mono whitespace-nowrap">
                      {formatAucklandTime(entry.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* Grand Total Footer Row */}
            {!isLoading && filteredEntries.length > 0 && (
              <tfoot>
                <tr className="bg-gradient-to-r from-emerald-800 via-teal-800 to-green-800 text-white font-extrabold text-sm border-t-2 border-emerald-900 shadow-xs">
                  <td colSpan={6} className="py-3 px-4 text-left border-r border-emerald-700/60">
                    全量合计 ({totals.count} 条记录)
                  </td>
                  <td className="py-3 px-3 text-right text-emerald-100 border-r border-emerald-700/60">
                    {totals.grandBag || 0}
                  </td>
                  <td className="py-3 px-3 text-right text-emerald-100 border-r border-emerald-700/60">
                    {totals.grandLoose || 0}
                  </td>
                  <td className="py-3 px-3 text-right text-amber-300 text-base font-black border-r border-emerald-700/60 bg-emerald-950/60">
                    {totals.grandTotal} 筐
                  </td>
                  <td colSpan={2} className="py-3 px-3 text-xs text-emerald-200 font-medium">
                    Grand Total
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Export Toolbar Button */}
      {filteredEntries.length > 0 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-gray-400">
            共筛选出 <strong className="text-gray-700">{filteredEntries.length}</strong> 条明细数据
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportHarvestDetail(filteredEntries, date || 'selected', selectedTeam)}
            className="text-xs gap-1.5 font-bold border-gray-300 hover:bg-green-50 hover:text-green-700"
          >
            <Download className="w-3.5 h-3.5 text-green-600" />
            导出当前表格 Excel
          </Button>
        </div>
      )}
    </div>
  )
}
