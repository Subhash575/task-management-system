import { useId } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { TASK_PRIORITIES, TASK_SCOPES, TASK_STATUSES } from './tasks'

function FilterSelect({ label, value, onChange, allLabel, options }) {
  const id = useId()
  const active = value !== ''
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs font-medium tracking-wide text-slate-600 uppercase dark:text-slate-300">
        {label}
      </Label>
      {/* A chosen filter gets an indigo outline and tint, so active filters are easy to spot. */}
      <NativeSelect
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full ${
          active
            ? 'border-indigo-300 bg-indigo-50 font-medium text-indigo-900 focus-visible:ring-indigo-500/40 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-100'
            : 'bg-background'
        }`}
      >
        <NativeSelectOption value="">{allLabel}</NativeSelectOption>
        {options.map((option) => (
          <NativeSelectOption key={option.value} value={option.value}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  )
}

const asOptions = (values) => values.map((value) => ({ value, label: value }))

export function TaskFilters({ filters, onChange, onClear, hideStatus = false }) {
  // The board is already split by status, so it hides the status filter and ignores it.
  const hasFilters = Boolean((!hideStatus && filters.status) || filters.priority || filters.scope)

  return (
    <form
      role="search"
      aria-label="Filter tasks"
      onSubmit={(event) => event.preventDefault()}
      className={`grid gap-3 rounded-xl border bg-slate-50 p-3 sm:grid-cols-2 sm:p-4 lg:items-end dark:bg-card ${
        hideStatus ? 'lg:grid-cols-[repeat(2,1fr)_auto]' : 'lg:grid-cols-[repeat(3,1fr)_auto]'
      }`}
    >
      {!hideStatus && (
        <FilterSelect
          label="Status"
          value={filters.status}
          onChange={(status) => onChange({ status })}
          allLabel="All statuses"
          options={asOptions(TASK_STATUSES)}
        />
      )}
      <FilterSelect
        label="Priority"
        value={filters.priority}
        onChange={(priority) => onChange({ priority })}
        allLabel="All priorities"
        options={asOptions(TASK_PRIORITIES)}
      />
      <FilterSelect
        label="Show"
        value={filters.scope}
        onChange={(scope) => onChange({ scope })}
        allLabel="All my tasks"
        options={TASK_SCOPES}
      />
      {/* Always in the same place so the toolbar doesn't shift; it is enabled and highlighted while filters are active. */}
      <Button
        type="button"
        variant="ghost"
        onClick={onClear}
        disabled={!hasFilters}
        className={`justify-self-start sm:col-span-2 lg:col-span-1 ${
          hasFilters ? 'text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 dark:text-indigo-300' : ''
        }`}
      >
        <X aria-hidden="true" />
        Clear filters
      </Button>
    </form>
  )
}
