'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useHarvestEntries } from '@/hooks/useHarvestEntries'
import { TEAMS, TEAM_COLORS } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Loader2, CalendarIcon, ChevronDown } from 'lucide-react'
import { useDateFilter } from '@/stores/dateFilter'

export default function ChartPage() {
  const { selectedDate, setSelectedDate } = useDateFilter()
  const [calOpen, setCalOpen] = useState(false)
  const { data: entries = [], isLoading } = useHarvestEntries({ date: selectedDate })

  const teamData = TEAMS.map(t => ({
    name: t,
    value: entries.filter(e => e.team === t).reduce((s, e) => s + e.total_qty, 0),
    color: TEAM_COLORS[t],
  })).filter(d => d.value > 0)

  const grandTotal = teamData.reduce((s, d) => s + d.value, 0)

  return (
    <div className="space-y-4">
      {/* Date Picker */}
      <Popover open={calOpen} onOpenChange={setCalOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full h-12 text-base justify-between">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-green-600" />
              {format(new Date(selectedDate + 'T12:00:00'), 'yyyy年MM月dd日')}
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="center">
          <Calendar
            mode="single"
            selected={new Date(selectedDate + 'T12:00:00')}
            onSelect={date => { if (date) { setSelectedDate(format(date, 'yyyy-MM-dd')); setCalOpen(false) } }}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      {/* Grand Total */}
      <div className="bg-gradient-to-br from-green-600 to-emerald-700 rounded-2xl p-5 text-white shadow-lg text-center">
        <p className="text-sm text-green-100">全场总收菜量</p>
        <p className="text-5xl font-black mt-1">{grandTotal}</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
      ) : grandTotal === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">该日期暂无数据</div>
      ) : (
        <>
          {/* Donut Chart */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h2 className="text-sm font-semibold text-gray-600 mb-3">各团队收菜占比</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={teamData}
                    cx="50%"
                    cy="50%"
                    innerRadius="55%"
                    outerRadius="80%"
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {teamData.map(entry => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [value, '总数量']}
                    contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Team breakdown list */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {teamData.sort((a, b) => b.value - a.value).map(d => (
              <div key={d.name} className="flex items-center justify-between px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <span
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: d.color }}
                  >
                    {d.name}
                  </span>
                  <span className="text-sm text-gray-600">团队 {d.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-bold text-gray-900">{d.value}</span>
                  <span className="text-xs text-gray-400 ml-1">
                    ({Math.round(d.value / grandTotal * 100)}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
