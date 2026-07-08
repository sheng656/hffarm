import { create } from 'zustand'
import { format } from 'date-fns'

interface DateFilterState {
  selectedDate: string // ISO date string YYYY-MM-DD
  setSelectedDate: (date: string) => void
  setToday: () => void
}

export const useDateFilter = create<DateFilterState>((set) => ({
  selectedDate: format(new Date(), 'yyyy-MM-dd'),
  setSelectedDate: (date) => set({ selectedDate: date }),
  setToday: () => set({ selectedDate: format(new Date(), 'yyyy-MM-dd') }),
}))
