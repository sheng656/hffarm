'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useHarvestEntries } from '@/hooks/useHarvestEntries'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Download, CalendarIcon, ChevronDown, CheckCircle2, AlertCircle } from 'lucide-react'
import { useDateFilter } from '@/stores/dateFilter'
import { exportDailyRegister } from '@/lib/export-excel'
import { toast } from 'sonner'

export default function ExportPage() {
  const { selectedDate, setSelectedDate } = useDateFilter()
  const [calOpen, setCalOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  const { data: entries = [], isLoading } = useHarvestEntries({ date: selectedDate })

  const displayDate = format(new Date(selectedDate + 'T12:00:00'), 'yyyy年MM月dd日', { locale: zhCN })

  const greenhouseCount = entries.filter(e => e.area_category === '棚内区域').length
  const outdoorCount = entries.filter(e => e.area_category === '户外WF03区域').length
  const purchaseCount = entries.filter(e => e.area_category === '外采').length
  const importCount = entries.filter(e => e.area_category === '进口').length

  const handleExport = () => {
    if (entries.length === 0) {
      toast.warning('该日期暂无收菜登记数据，无法导出')
      return
    }

    setExporting(true)
    try {
      exportDailyRegister(entries, selectedDate)
      toast.success('🎉 导出成功！', {
        description: `已生成 ${selectedDate}_農場成品菜登記表.xlsx`
      })
    } catch (err: any) {
      toast.error('导出失败', { description: err?.message || '未知错误' })
    } finally {
      setExporting(false)
    }
  }

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
            selected={new Date(selectedDate + 'T12:00:00')}
            onSelect={date => { if (date) { setSelectedDate(format(date, 'yyyy-MM-dd')); setCalOpen(false) } }}
          />
        </PopoverContent>
      </Popover>

      <Card className="shadow-sm border-gray-100">
        <CardHeader>
          <CardTitle className="text-base">导出农场成品菜登记表</CardTitle>
          <CardDescription>
            导出符合农场每日成品菜格式的 Excel 文件，按大棚、户外、外采进行分区汇总。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-green-600" />
              <span className="text-sm text-gray-400">正在统计数据...</span>
            </div>
          ) : (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-3 text-center">
                <StatBox title="大棚收菜" value={greenhouseCount} emoji="🏠" />
                <StatBox title="Outdoor收菜" value={outdoorCount} emoji="🌿" />
                <StatBox title="外采菜入库" value={purchaseCount} emoji="🚛" />
                <StatBox title="进口菜入库" value={importCount} emoji="✈️" />
              </div>

              {entries.length > 0 ? (
                <div className="flex items-start gap-2.5 bg-green-50 text-green-800 rounded-xl p-3.5 text-xs">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-green-600" />
                  <div>
                    <span className="font-semibold block">共有 {entries.length} 条流水数据已就绪</span>
                    导出的表格中，当日产量将由以上流水自动累加汇总，上日库存默认设为 0，出货量 1 默认等于当日产量。下载后请根据实际销售/物流手动调整出货量和库存。
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2.5 bg-amber-50 text-amber-800 rounded-xl p-3.5 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <span className="font-semibold block">当日暂无数据</span>
                    请先在「录入」页面添加今日的数据流水，或在上方选择已登记过的历史日期。
                  </div>
                </div>
              )}

              <Button
                onClick={handleExport}
                className="w-full h-13 text-base font-semibold bg-green-600 hover:bg-green-700"
                disabled={entries.length === 0 || exporting}
              >
                {exporting ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" />正在生成...</>
                ) : (
                  <><Download className="w-5 h-5 mr-2" />导出成品菜登记表</>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatBox({ title, value, emoji }: { title: string; value: number; emoji: string }) {
  return (
    <div className="border border-gray-100 bg-gray-50/50 rounded-xl p-3">
      <div className="text-xl mb-0.5">{emoji}</div>
      <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">{title}</div>
      <div className="text-lg font-bold text-gray-800 mt-0.5">{value} 条记录</div>
    </div>
  )
}
