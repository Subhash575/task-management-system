import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { useUsers } from '@/features/users/users'
import { Field } from './Field'

/**
 * Assignee picker backed by GET /api/users. "" means unassigned.
 * `currentAssignee` is the task's existing assignee, kept as an option even if the list is
 * still loading, failed, or does not include them, so the form never silently drops it.
 */
export function AssigneeField({ value, onChange, error, currentAssignee }) {
  const { data, isPending, isError, isFetching, refetch } = useUsers()

  const users = data?.users ?? []
  const options = [...users]
  if (currentAssignee && !options.some((user) => user.id === currentAssignee.id)) options.unshift(currentAssignee)

  let hint
  if (isPending) hint = 'Loading users…'
  else if (!isError && users.length === 0) hint = 'No registered users found.'

  return (
    <div className="flex flex-col gap-1.5">
      <Field label="Assignee" error={error} hint={hint}>
        {(props) => (
          <NativeSelect
            {...props}
            value={value}
            onChange={onChange}
            disabled={isPending || isError}
            aria-busy={isPending || undefined}
            className="w-full"
          >
            <NativeSelectOption value="">Unassigned</NativeSelectOption>
            {options.map((user) => (
              <NativeSelectOption key={user.id} value={user.id}>
                {user.name} ({user.email})
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
      </Field>
      {isError && (
        <div className="flex flex-wrap items-center gap-2">
          <p role="alert" className="text-sm text-destructive">
            Could not load users.
          </p>
          <Button type="button" variant="outline" size="xs" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={isFetching ? 'animate-spin' : undefined} aria-hidden="true" />
            Retry
          </Button>
        </div>
      )}
    </div>
  )
}
