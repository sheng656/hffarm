'use client'

import { useState, use } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { formatAucklandDate, formatAucklandDateLabel, toAucklandCalendarDate } from '@/lib/auckland-time'
import { useStatsData } from '@/hooks/useStatsData'
import { exportStatsDaily, exportStatsWeekly } from '@/lib/export-excel'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Loader2, CalendarIcon, ChevronDown, Download, Layers, Box, AlertCircle, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

const TODAY = formatAucklandDate()

export default function StatsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const dateParam = searchParams.get('date')
  const initialDate = dateParam === 'today' ? TODAY : (dateParam || TODAY)

  const [selectedDate, setSelectedDate] = useState(initialDate)
  const [calOpen, setCalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'pallet' | 'crate'>('pallet')
  const [exportingWeekly, setExportingWeekly] = useState(false)

  const {
    palletStats,
    crateStats,
    totalPallets,
    totalCrates,
    hasOldData,
    isLoading,
  } = useStatsData({ date: selectedDate })

  const displayDate = formatAucklandDateLabel(selectedDate)

  const handleExportWeekly = async () => {
    try {
      setExportingWeekly(true)
      await exportStatsWeekly(selectedDate)
    } finally {
      setExportingWeekly(false)
    }
  }

  return (
    <div className="space-y-4 pb-12">
      {/* Top Navigation & Date Selector */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-10 px-3 shrink-0 rounded-xl"
          onClick={() => router.back()}
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          返回
        </Button>

        <Popover open={calOpen} onOpenChange={setCalOpen}>
          <PopoverTrigger
            render={
              <Button variant="outline" className="w-full h-10 text-sm justify-between rounded-xl flex-1">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-green-600" />
                  <span className="font-semibold text-gray-800">{displayDate}</span>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </Button>
            }
          />
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={toAucklandCalendarDate(selectedDate)}
              onSelect={(date) => {
                if (date) {
                  const formatted = formatAucklandDate(date)
                  setSelectedDate(formatted)
                  setCalOpen(false)
                }
              }}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div
          onClick={() => setActiveTab('pallet')}
          className={cn(
            'p-4 rounded-2xl border-2 transition-all cursor-pointer shadow-xs flex flex-col justify-between',
            activeTab === 'pallet'
              ? 'bg-gradient-to-br from-green-600 to-emerald-700 text-white border-green-600 shadow-md scale-[1.01]'
              : 'bg-white text-gray-800 border-gray-100 hover:border-green-200'
          )}
        >
          <div className="flex items-center justify-between">
            <span className={cn('text-xs font-bold uppercase tracking-wider', activeTab === 'pallet' ? 'text-green-100' : 'text-gray-400')}>
              总使用板数
            </span>
            <Layers className={cn('w-4 h-4', activeTab === 'pallet' ? 'text-green-200' : 'text-green-600')} />
          </div>
          <div className="mt-2">
            <p className="text-3xl font-black tracking-tight">{totalPallets}</p>
            <p className={cn('text-[10px] mt-1', activeTab === 'pallet' ? 'text-green-100' : 'text-gray-400')}>
              {hasOldData ? '*含旧版单条录入数据' : '物理板数汇总'}
            </p>
          </div>
        </div>

        <div
          onClick={() => setActiveTab('crate')}
          className={cn(
            'p-4 rounded-2xl border-2 transition-all cursor-pointer shadow-xs flex flex-col justify-between',
            activeTab === 'crate'
              ? 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white border-emerald-600 shadow-md scale-[1.01]'
              : 'bg-white text-gray-800 border-gray-100 hover:border-emerald-200'
          )}
        >
          <div className="flex items-center justify-between">
            <span className={cn('text-xs font-bold uppercase tracking-wider', activeTab === 'crate' ? 'text-emerald-100' : 'text-gray-400')}>
              总使用筐数
            </span>
            <Box className={cn('w-4 h-4', activeTab === 'crate' ? 'text-emerald-200' : 'text-emerald-600')} />
          </div>
          <div className="mt-2">
            <p className="text-3xl font-black tracking-tight">{totalCrates}</p>
            <p className={cn('text-[10px] mt-1', activeTab === 'crate' ? 'text-emerald-100' : 'text-gray-400')}>
              包装筐数汇总
            </p>
          </div>
        </div>
      </div>

      {/* Segment Tabs */}
      <div className="grid grid-cols-2 p-1 bg-gray-100/80 rounded-xl text-xs font-bold text-gray-600">
        <button
          type="button"
          onClick={() => setActiveTab('pallet')}
          className={cn(
            'py-2.5 rounded-lg transition-all text-center flex items-center justify-center gap-1.5',
            activeTab === 'pallet' ? 'bg-white text-green-700 shadow-sm' : 'hover:text-gray-900'
          )}
        >
          <Layers className="w-3.5 h-3.5" />
          按板型统计 (Pallet)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('crate')}
          className={cn(
            'py-2.5 rounded-lg transition-all text-center flex items-center justify-center gap-1.5',
            activeTab === 'crate' ? 'bg-white text-green-700 shadow-sm' : 'hover:text-gray-900'
          )}
        >
          <Box className="w-3.5 h-3.5" />
          按箱型统计 (Crate)
        </button>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
        </div>
      ) : activeTab === 'pallet' ? (
        <div className="space-y-3">
          {/* Old Data Prompt Notice (Only displayed if there IS old data for this date) */}
          {hasOldData && (
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200/60 p-3 rounded-xl text-amber-900 text-xs">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">包含旧版单条录入数据</p>
                <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                  旧系统录入的数据没有整板关联（`pallet_id` 为空）。此处将旧数据的每条记录暂按 1 板进行兼容统计。
                </p>
              </div>
            </div>
          )}

          {palletStats.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">
              该日期暂无板型记录
            </div>
          ) : (
            <div className="space-y-2">
              {palletStats.map(item => (
                <div key={item.pallet_type} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-xs flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-gray-900">{item.pallet_type} 板</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-green-50 text-green-700 border border-green-100">
                        {item.total} 板
                      </span>
                    </div>
                    {hasOldData && item.old_count > 0 && (
                      <p className="text-[11px] text-gray-400 mt-1 flex gap-2 font-medium">
                        {item.new_count > 0 && <span>物理整板: {item.new_count}</span>}
                        <span>旧录入: {item.old_count} 条</span>
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-green-700">{item.total}</span>
                    <span className="text-xs font-semibold text-gray-400 ml-1">板</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {crateStats.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">
              该日期暂无箱型记录
            </div>
          ) : (
            <div className="space-y-2">
              {crateStats.map(item => {
                const percent = totalCrates > 0 ? Math.round((item.total_qty / totalCrates) * 100) : 0
                return (
                  <div key={item.crate} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold text-gray-900">{item.crate}</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-emerald-700">{item.total_qty}</span>
                        <span className="text-xs font-semibold text-gray-400">筐 ({percent}%)</span>
                      </div>
                    </div>
                    {/* Visual Progress Bar */}
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Export Section */}
      <div className="pt-4 border-t border-gray-150 space-y-2">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">数据导出</h3>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="h-11 text-xs gap-1.5 font-bold border-gray-200"
            onClick={() => exportStatsDaily(selectedDate, palletStats, crateStats, hasOldData)}
          >
            <Download className="w-3.5 h-3.5 text-green-600" />
            导出当日统计 Excel
          </Button>

          <Button
            variant="outline"
            className="h-11 text-xs gap-1.5 font-bold border-gray-200"
            disabled={exportingWeekly}
            onClick={handleExportWeekly}
          >
            {exportingWeekly ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-green-600" />
            ) : (
              <Download className="w-3.5 h-3.5 text-green-600" />
            )}
            导出一周统计 (7天)
          </Button>
        </div>
      </div>
    </div>
  )
}
