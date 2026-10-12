import { useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { describeError } from './taskForm'
import { useDeleteTask } from './tasks'

function DeleteTaskBody({ task, onDeleted }) {
  const [error, setError] = useState(null)
  const deleteTask = useDeleteTask()

  function confirm() {
    if (deleteTask.isPending) return
    setError(null)
    deleteTask.mutate(task.id, {
      onSuccess: () => onDeleted(task),
      onError: (err) => setError(describeError(err)),
    })
  }

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete this task?</AlertDialogTitle>
        <AlertDialogDescription>
          “{task.title}” will be permanently deleted. This cannot be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      {error && (
        <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={deleteTask.isPending}>Cancel</AlertDialogCancel>
        {/* A plain Button (not AlertDialogAction) so the dialog stays open until the request finishes. */}
        <Button variant="destructive" onClick={confirm} disabled={deleteTask.isPending}>
          {deleteTask.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
          {deleteTask.isPending ? 'Deleting…' : 'Delete'}
        </Button>
      </AlertDialogFooter>
    </>
  )
}

/** Open while `task` is set. Asks for explicit confirmation before calling DELETE. */
export function DeleteTaskDialog({ task, onClose, onDeleted }) {
  return (
    <AlertDialog open={Boolean(task)} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        {task && <DeleteTaskBody key={task.id} task={task} onDeleted={onDeleted} />}
      </AlertDialogContent>
    </AlertDialog>
  )
}
