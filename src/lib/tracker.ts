export type Habit = {
  id: string
  name: string
  color: string
}

export type TrackerData = {
  version: 1
  title: string
  startDate: string
  habits: Habit[]
  completions: Record<string, string[]>
}

export const STORAGE_KEY = 'daily-habits-v1'

export const HABIT_COLORS = [
  '#e7684f',
  '#5678d4',
  '#2f9178',
  '#a765c3',
  '#d58a28',
  '#397f9f',
]

export function dateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function fromDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function addDays(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount)
}

export function daysBetween(start: Date, end: Date): Date[] {
  const dates: Date[] = []
  for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 1)) {
    dates.push(cursor)
  }
  return dates
}

export function daysInMonth(cursor: Date): Date[] {
  const lastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
  return Array.from(
    { length: lastDay },
    (_, index) => new Date(cursor.getFullYear(), cursor.getMonth(), index + 1),
  )
}

export function createHabit(name: string, index: number): Habit {
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    color: HABIT_COLORS[index % HABIT_COLORS.length],
  }
}

export function loadTrackerData(): TrackerData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<TrackerData>
    if (
      parsed.version !== 1 ||
      typeof parsed.title !== 'string' ||
      typeof parsed.startDate !== 'string' ||
      !Array.isArray(parsed.habits) ||
      !parsed.completions
    ) {
      return null
    }
    return parsed as TrackerData
  } catch {
    return null
  }
}

export function saveTrackerData(data: TrackerData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Tracking still works for this session if storage is unavailable.
  }
}

function csvCell(value: string | number): string {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function createCsv(data: TrackerData, through = new Date()): string {
  const start = fromDateKey(data.startDate)
  const end = through < start ? start : through
  const headers = [
    'Date',
    'Day',
    ...data.habits.map((habit) => habit.name),
    'Completed',
    'Possible',
    'Percent',
  ]
  const rows = daysBetween(start, end).map((date) => {
    const completed = new Set(data.completions[dateKey(date)] ?? [])
    const total = data.habits.filter((habit) => completed.has(habit.id)).length
    const percent = data.habits.length ? Math.round((total / data.habits.length) * 100) : 0
    return [
      dateKey(date),
      date.toLocaleDateString('en-US', { weekday: 'long' }),
      ...data.habits.map((habit) => (completed.has(habit.id) ? 'Yes' : 'No')),
      total,
      data.habits.length,
      `${percent}%`,
    ]
  })
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
}
