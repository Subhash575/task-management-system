// Date-only due dates are stored as midnight UTC, so format in UTC to avoid showing the previous day.
export const dueDateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' })

/** Today as a calendar date in the user's own time zone, "YYYY-MM-DD". */
function localToday() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/**
 * A due date is a calendar day, so a task is overdue once that day is before today, unless it is already completed.
 * Comparing "YYYY-MM-DD" strings avoids any time-of-day or time-zone guesswork. Shared by the list and the board.
 */
export function isOverdue(task) {
  return Boolean(task.dueDate) && task.status !== 'Completed' && task.dueDate.slice(0, 10) < localToday()
}

// The coloured dot in each board column header; matches the hue of the status badge.
export const STATUS_DOT = {
  Idea: 'bg-violet-500',
  'To Do': 'bg-slate-400',
  'In Progress': 'bg-blue-500',
  'In Review': 'bg-amber-500',
  Completed: 'bg-emerald-500',
}
