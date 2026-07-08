import { create } from 'zustand'
import { formatAucklandDate } from '@/lib/auckland-time'

interface DateFilterState {
  selectedDate: string // ISO date string YYYY-MM-DD
  setSelectedDate: (date: string) => void
  setToday: () => void
}

export const useDateFilter = create<DateFilterState>((set) => ({
  selectedDate: formatAucklandDate(),
  setSelectedDate: (date) => set({ selectedDate: date }),
  setToday: () => set({ selectedDate: formatAucklandDate() }),
}))
