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
import { buildUpdatePayload, splitServerError, taskToFormValues, validateTaskForm } from './taskForm'
import { useUpdateTask } from './tasks'

/** Pre-filled from `task`; remounted per task by the parent dialog, so values never leak between tasks. */
function EditTaskForm({ task, statusOnly, onCancel, onUpdated }) {
  const [values, setValues] = useState(() => taskToFormValues(task))
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const updateTask = useUpdateTask()

  const update = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value }))

  function handleSubmit(event) {
    event.preventDefault()
    if (updateTask.isPending) return // guards against Enter-key double submits

    // Assignees only ever change the status, so the other fields are not validated or sent.
    const clientErrors = statusOnly ? {} : validateTaskForm(values)
    setErrors(clientErrors)
    setFormError(null)
    if (Object.keys(clientErrors).length > 0) return

    const changes = buildUpdatePayload(task, values, { statusOnly })
    if (Object.keys(changes).length === 0) {
      onCancel() // nothing changed, and the API rejects an empty update anyway
      return
    }

    updateTask.mutate(
      { id: task.id, changes },
      {
        onSuccess: ({ task: updated }) => onUpdated(updated),
        onError: (error) => {
          const { fieldErrors, formError: message } = splitServerError(error)
          setErrors(fieldErrors)
          setFormError(message)
        },
      },
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {formError && (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <TaskFormFields
        values={values}
        errors={errors}
        update={update}
        statusOnly={statusOnly}
        currentAssignee={task.assignee}
      />

      <DialogFooter className="gap-2 sm:gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={updateTask.isPending}>
          {updateTask.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
          {updateTask.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Open while `task` is set. `statusOnly` limits the form to the status, for assignees who are not the creator. */
export function EditTaskDialog({ task, statusOnly = false, onClose, onUpdated }) {
  return (
    <Dialog open={Boolean(task)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit task</DialogTitle>
          <DialogDescription>
            {statusOnly
              ? 'This task is assigned to you, so you can only change its status.'
              : 'Fields marked * are required.'}
          </DialogDescription>
        </DialogHeader>
        {task && (
          <EditTaskForm key={task.id} task={task} statusOnly={statusOnly} onCancel={onClose} onUpdated={onUpdated} />
        )}
      </DialogContent>
    </Dialog>
  )
}
