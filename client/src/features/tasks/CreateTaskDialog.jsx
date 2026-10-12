import { useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
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
import { TaskFormFields } from './TaskFormFields'
import { INITIAL_FORM, buildCreatePayload, splitServerError, validateTaskForm } from './taskForm'
import { useCreateTask } from './tasks'

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
        const { fieldErrors, formError: message } = splitServerError(error)
        setErrors(fieldErrors)
        setFormError(message)
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

      <TaskFormFields values={values} errors={errors} update={update} />

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
