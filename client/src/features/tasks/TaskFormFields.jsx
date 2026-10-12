import { useId } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { LIMITS } from './taskForm'
import { TASK_PRIORITIES, TASK_STATUSES } from './tasks'

/** Label + control + hint + inline error, wired together for screen readers. */
export function Field({ label, required, error, hint, children }) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required && (
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        )}
      </Label>
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-required': required || undefined,
        'aria-describedby': describedBy,
      })}
      {hint && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

const StatusSelect = ({ values, errors, update }) => (
  <Field label="Status" error={errors.status}>
    {(props) => (
      <NativeSelect {...props} value={values.status} onChange={update('status')} className="w-full">
        {TASK_STATUSES.map((status) => (
          <NativeSelectOption key={status} value={status}>
            {status}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    )}
  </Field>
)

/**
 * The shared task fields. With `statusOnly` (assignees may only change the status) just the status is shown.
 * Assignee is deferred until the API can list users, so `showAssignee` renders a disabled placeholder.
 */
export function TaskFormFields({ values, errors, update, statusOnly = false, showAssignee = false }) {
  if (statusOnly) return <StatusSelect values={values} errors={errors} update={update} />

  return (
    <>
      <Field label="Title" required error={errors.title}>
        {(props) => (
          <Input {...props} value={values.title} onChange={update('title')} maxLength={LIMITS.title + 50} autoFocus />
        )}
      </Field>

      <Field label="Description" error={errors.description} hint={`Optional. Up to ${LIMITS.description} characters.`}>
        {(props) => <Textarea {...props} rows={4} value={values.description} onChange={update('description')} />}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatusSelect values={values} errors={errors} update={update} />
        <Field label="Priority" error={errors.priority}>
          {(props) => (
            <NativeSelect {...props} value={values.priority} onChange={update('priority')} className="w-full">
              {TASK_PRIORITIES.map((priority) => (
                <NativeSelectOption key={priority} value={priority}>
                  {priority}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Due date" error={errors.dueDate}>
          {(props) => <Input {...props} type="date" value={values.dueDate} onChange={update('dueDate')} />}
        </Field>
        {/* There is no endpoint for listing users yet, so assigning is deferred rather than faked. */}
        {showAssignee && (
          <Field label="Assignee" hint="Assigning people is not available yet.">
            {(props) => (
              <NativeSelect {...props} disabled className="w-full">
                <NativeSelectOption value="">Unassigned</NativeSelectOption>
              </NativeSelect>
            )}
          </Field>
        )}
      </div>

      <Field
        label="Labels"
        error={errors.labels}
        hint={`Optional. Separate with commas (up to ${LIMITS.labels}, ${LIMITS.label} characters each).`}
      >
        {(props) => <Input {...props} value={values.labels} onChange={update('labels')} placeholder="bug, ui" />}
      </Field>
    </>
  )
}
