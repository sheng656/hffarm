'use client'

import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { formatAucklandDate, formatAucklandDateLabel, toAucklandCalendarDate } from '@/lib/auckland-time'
import { useHarvestEntries } from '@/hooks/useHarvestEntries'
import { ExcelDetailTable } from '@/components/forms/ExcelDetailTable'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon, ChevronDown, ArrowLeft, FileSpreadsheet } from 'lucide-react'

const TODAY = formatAucklandDate()

export default function DetailPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const dateParam = searchParams.get('date')
  const initialDate = dateParam === 'today' ? TODAY : (dateParam || TODAY)

  const [selectedDate, setSelectedDate] = useState(initialDate)
  const [calOpen, setCalOpen] = useState(false)

  const { data: entries = [], isLoading } = useHarvestEntries({ date: selectedDate })

  const displayDate = formatAucklandDateLabel(selectedDate)

  return (
    <div className="space-y-4 pb-12">
      {/* Top Header & Navigation */}
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
              <Button variant="outline" className="w-full h-10 text-sm justify-between rounded-xl flex-1 border-gray-200">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-green-600" />
                  <span className="font-bold text-gray-800">{displayDate}</span>
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
                  setSelectedDate(formatAucklandDate(date))
                  setCalOpen(false)
                }
              }}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Main Title Badge Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-green-700 text-white rounded-2xl p-4 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-white shrink-0">
            <FileSpreadsheet className="w-5 h-5 text-emerald-100" />
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-tight">收菜全量明细大表</h1>
            <p className="text-xs text-emerald-100/90 mt-0.5">{displayDate} 收量归集流水</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-2xl font-black text-amber-300">
            {entries.reduce((sum, e) => sum + (e.total_qty || 0), 0)}
          </span>
          <span className="text-xs font-semibold text-emerald-100 ml-1">筐</span>
        </div>
      </div>

      {/* Excel Table Component */}
      <ExcelDetailTable entries={entries} isLoading={isLoading} date={selectedDate} />
    </div>
  )
}
