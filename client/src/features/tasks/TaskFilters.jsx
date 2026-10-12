import { useId } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { TASK_PRIORITIES, TASK_SCOPES, TASK_STATUSES } from './tasks'

function FilterSelect({ label, value, onChange, allLabel, options }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect id={id} value={value} onChange={(event) => onChange(event.target.value)} className="w-full">
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

export function TaskFilters({ filters, onChange, onClear }) {
  const hasFilters = Boolean(filters.status || filters.priority || filters.scope)

  return (
    <form
      role="search"
      aria-label="Filter tasks"
      onSubmit={(event) => event.preventDefault()}
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(3,1fr)_auto] lg:items-end"
    >
      <FilterSelect
        label="Status"
        value={filters.status}
        onChange={(status) => onChange({ status })}
        allLabel="All statuses"
        options={asOptions(TASK_STATUSES)}
      />
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
      <Button type="button" variant="ghost" onClick={onClear} disabled={!hasFilters}>
        Clear filters
      </Button>
    </form>
  )
}
