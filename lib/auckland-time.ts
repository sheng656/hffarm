const AUCKLAND_TIME_ZONE = 'Pacific/Auckland'

function resolveDate(input: Date | number | string) {
  return input instanceof Date ? input : new Date(input)
}

function getAucklandParts(input: Date | number | string = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: AUCKLAND_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(resolveDate(input))

  const values = Object.fromEntries(parts.map(part => [part.type, part.value])) as Record<string, string>

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  }
}

export function formatAucklandDate(input: Date | number | string = new Date()) {
  const parts = getAucklandParts(input)
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function formatAucklandDateLabel(input: Date | number | string = new Date()) {
  const parts = getAucklandParts(input)
  return `${Number(parts.year)}年${Number(parts.month)}月${Number(parts.day)}日`
}

export function formatAucklandTime(input: Date | number | string = new Date()) {
  const parts = getAucklandParts(input)
  return `${parts.hour}:${parts.minute}`
}

export function formatAucklandDateTime(input: Date | number | string = new Date()) {
  const parts = getAucklandParts(input)
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`
}

export function formatAucklandFileTimestamp(input: Date | number | string = new Date()) {
  const parts = getAucklandParts(input)
  return `${parts.year}${parts.month}${parts.day}_${parts.hour}${parts.minute}${parts.second}`
}

export function parseExcelDateToAucklandDate(value: unknown) {
  if (value instanceof Date) {
    return formatAucklandDate(value)
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return formatAucklandDate(value)
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return ''
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed

    const parsed = new Date(trimmed)
    if (!Number.isNaN(parsed.getTime())) {
      return formatAucklandDate(parsed)
    }

    return trimmed
  }

  return ''
}

export function toAucklandCalendarDate(dateString: string) {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0)
}