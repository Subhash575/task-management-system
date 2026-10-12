import { useId, useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { ApiError } from '@/lib/api'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { FORM_FIELDS, INITIAL_FORM, LIMITS, buildCreatePayload, validateTaskForm } from './taskForm'
import { TASK_PRIORITIES, TASK_STATUSES, useCreateTask } from './tasks'

/** Label + control + hint + inline error, wired together for screen readers. */
function Field({ label, required, error, hint, children }) {
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

/** Server messages for 4xx are safe to show; anything else gets a generic message. */
function describeError(error) {
  if (error instanceof ApiError && error.status < 500) return error.message
  if (error instanceof ApiError) return 'Something went wrong on our side. Please try again.'
  return 'Could not reach the server. Check your connection and try again.'
}

/**
 * The form lives in its own component so Radix unmounts it when the dialog closes,
 * which resets every value. Values are therefore only cleared by closing (success or Cancel).
 */
function CreateTaskForm({ onCancel, onCreated }) {
  const [values, setValues] = useState(INITIAL_FORM)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const createTask = useCreateTask()

  const update = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value }))

  function handleSubmit(event) {
    event.preventDefault()
    if (createTask.isPending) return // guards against Enter-key double submits

    const clientErrors = validateTaskForm(values)
    setErrors(clientErrors)
    setFormError(null)
    if (Object.keys(clientErrors).length > 0) return

    createTask.mutate(buildCreatePayload(values), {
      onSuccess: ({ task }) => onCreated(task),
      onError: (error) => {
        // Field-level server messages go next to the field; everything else goes in the alert.
        const fieldErrors = {}
        for (const detail of error.details ?? []) {
          if (FORM_FIELDS.includes(detail.path) && !fieldErrors[detail.path]) fieldErrors[detail.path] = detail.message
        }
        setErrors(fieldErrors)
        if (Object.keys(fieldErrors).length === 0) setFormError(describeError(error))
      },
    })
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {formError && (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <Field label="Title" required error={errors.title}>
        {(props) => (
          <Input {...props} value={values.title} onChange={update('title')} maxLength={LIMITS.title + 50} autoFocus />
        )}
      </Field>

      <Field label="Description" error={errors.description} hint={`Optional. Up to ${LIMITS.description} characters.`}>
        {(props) => <Textarea {...props} rows={4} value={values.description} onChange={update('description')} />}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
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
        <Field label="Assignee" hint="Assigning people is not available yet.">
          {(props) => (
            <NativeSelect {...props} disabled className="w-full">
              <NativeSelectOption value="">Unassigned</NativeSelectOption>
            </NativeSelect>
          )}
        </Field>
      </div>

      <Field
        label="Labels"
        error={errors.labels}
        hint={`Optional. Separate with commas (up to ${LIMITS.labels}, ${LIMITS.label} characters each).`}
      >
        {(props) => <Input {...props} value={values.labels} onChange={update('labels')} placeholder="bug, ui" />}
      </Field>

      <DialogFooter className="gap-2 sm:gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={createTask.isPending}>
          {createTask.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
          {createTask.isPending ? 'Creating…' : 'Create Task'}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function CreateTaskDialog({ open, onOpenChange, onCreated }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create task</DialogTitle>
          <DialogDescription>Fields marked * are required.</DialogDescription>
        </DialogHeader>
        <CreateTaskForm onCancel={() => onOpenChange(false)} onCreated={onCreated} />
      </DialogContent>
    </Dialog>
  )
}
