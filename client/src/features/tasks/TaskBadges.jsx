import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// Colour is never the only signal: the text label is always shown too.
const STATUS_STYLES = {
  Idea: 'border-violet-300 bg-violet-100 text-violet-800 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300',
  'To Do': 'border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
  'In Progress': 'border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300',
  'In Review': 'border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300',
  Completed:
    'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
}

const PRIORITY_STYLES = {
  Low: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
  Medium: 'border-sky-300 bg-sky-100 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300',
  High: 'border-orange-300 bg-orange-100 text-orange-900 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300',
  Critical: 'border-red-300 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300',
}

export function StatusBadge({ status }) {
  return <Badge className={cn(STATUS_STYLES[status])}>{status}</Badge>
}

export function PriorityBadge({ priority }) {
  return <Badge className={cn(PRIORITY_STYLES[priority])}>{priority} priority</Badge>
}
