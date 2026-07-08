'use client'

import { useRef } from 'react'
import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NumberStepperProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  label?: string
}

export function NumberStepper({
  value,
  onChange,
  min = 0,
  max = 9999,
  label,
}: NumberStepperProps) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function decrement() {
    onChange(Math.max(min, value - 1))
  }

  function increment() {
    onChange(Math.min(max, value + 1))
  }

  // Long-press fast increment/decrement
  function startLongPress(fn: () => void) {
    fn()
    intervalRef.current = setInterval(fn, 120)
  }

  function stopLongPress() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = parseInt(e.target.value, 10)
    if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)))
    else if (e.target.value === '') onChange(0)
  }

  return (
    <div className="space-y-1.5">
      {label && (
        <p className="text-sm font-medium text-gray-700">{label}</p>
      )}
      <div className="flex items-center gap-0 rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
        <button
          type="button"
          onPointerDown={() => startLongPress(decrement)}
          onPointerUp={stopLongPress}
          onPointerLeave={stopLongPress}
          disabled={value <= min}
          className={cn(
            'touch-target flex items-center justify-center w-14 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 transition-colors border-r border-gray-200',
            value <= min && 'opacity-40 cursor-not-allowed',
          )}
          aria-label="减少"
        >
          <Minus className="w-5 h-5 text-gray-600" strokeWidth={2.5} />
        </button>

        <input
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value === 0 ? '' : value}
          placeholder="0"
          onChange={handleInputChange}
          className="flex-1 text-center text-2xl font-bold text-gray-900 py-3 bg-transparent border-0 focus:outline-none focus:ring-0 w-0 min-w-0"
          min={min}
          max={max}
        />

        <button
          type="button"
          onPointerDown={() => startLongPress(increment)}
          onPointerUp={stopLongPress}
          onPointerLeave={stopLongPress}
          disabled={value >= max}
          className={cn(
            'touch-target flex items-center justify-center w-14 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 transition-colors border-l border-gray-200',
            value >= max && 'opacity-40 cursor-not-allowed',
          )}
          aria-label="增加"
        >
          <Plus className="w-5 h-5 text-gray-600" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}
