import { useId, useState } from 'react'
import { AlertCircle, CheckCircle2, Download, FileText, Loader2, Trash2, Upload, X } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ALLOWED_EXTENSIONS,
  MAX_ATTACHMENTS_PER_TASK,
  MAX_UPLOAD_BYTES,
  attachmentDownloadUrl,
  formatBytes,
  useDeleteAttachment,
  useUploadAttachment,
  validateFile,
} from './attachments'
import { dateTimeFormat } from './dateFormat'
import { describeError } from './taskForm'

function DeleteAttachmentDialog({ taskId, attachment, onClose, onDeleted }) {
  const deleteAttachment = useDeleteAttachment(taskId)
  const [error, setError] = useState(null)

  async function confirm() {
    if (deleteAttachment.isPending) return
    setError(null)
    try {
      await deleteAttachment.mutateAsync(attachment.id)
      onDeleted(attachment)
    } catch (err) {
      setError(describeError(err))
    }
  }

  return (
    <AlertDialog open onOpenChange={(open) => !open && !deleteAttachment.isPending && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this attachment?</AlertDialogTitle>
          <AlertDialogDescription>“{attachment.filename}” will be permanently deleted. This cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteAttachment.isPending}>Cancel</AlertDialogCancel>
          <Button variant="destructive" onClick={confirm} disabled={deleteAttachment.isPending}>
            {deleteAttachment.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            {deleteAttachment.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/**
 * Attachments of a task: list, download, upload and delete. `task.attachments` comes from the task detail response.
 * Which buttons appear mirrors the server's rules (the server decides): anyone who can see the task may upload;
 * the task's creator may delete any file; everyone else only their own uploads.
 */
export function TaskAttachments({ task, currentUserId }) {
  const inputId = useId()
  const hintId = `${inputId}-hint`
  const uploadAttachment = useUploadAttachment(task.id)
  const [file, setFile] = useState(null)
  const [fileError, setFileError] = useState(null)
  const [uploadError, setUploadError] = useState(null)
  const [uploaded, setUploaded] = useState(null)
  const [inputKey, setInputKey] = useState(0) // changing the key resets the native file input
  const [deleting, setDeleting] = useState(null)
  const [deleted, setDeleted] = useState(null)

  const attachments = task.attachments ?? []
  const atLimit = attachments.length >= MAX_ATTACHMENTS_PER_TASK
  const canDelete = (attachment) => task.creator?.id === currentUserId || attachment.uploadedBy?.id === currentUserId

  function resetPicker() {
    setFile(null)
    setFileError(null)
    setUploadError(null)
    setInputKey((key) => key + 1)
  }

  function handleChoose(event) {
    const chosen = event.target.files?.[0] ?? null
    setUploaded(null)
    setDeleted(null)
    setUploadError(null)
    setFile(chosen)
    setFileError(chosen ? validateFile(chosen) : null)
  }

  async function handleUpload() {
    if (!file || fileError || uploadAttachment.isPending) return
    setUploadError(null)
    setUploaded(null)
    try {
      const { attachment } = await uploadAttachment.mutateAsync(file)
      setUploaded(attachment.filename)
      resetPicker()
    } catch (error) {
      // Keep the chosen file so the user can simply try again.
      setUploadError(describeError(error))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {uploaded && (
        <Alert role="status">
          <CheckCircle2 aria-hidden="true" />
          <AlertDescription>“{uploaded}” was uploaded.</AlertDescription>
        </Alert>
      )}
      {deleted && (
        <Alert role="status">
          <CheckCircle2 aria-hidden="true" />
          <AlertDescription>“{deleted}” was deleted.</AlertDescription>
        </Alert>
      )}

      {attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No attachments yet.</p>
      ) : (
        <ul aria-label="Attachments" className="flex flex-col divide-y rounded-lg border">
          {attachments.map((attachment) => (
            <li key={attachment.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-2">
                <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-medium break-all">{attachment.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(attachment.size)} · {attachment.uploadedBy?.name ?? 'Unknown user'} ·{' '}
                    <time dateTime={attachment.createdAt}>{dateTimeFormat.format(new Date(attachment.createdAt))}</time>
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button asChild variant="outline" size="sm">
                  <a
                    href={attachmentDownloadUrl(task.id, attachment.id)}
                    download={attachment.filename}
                    aria-label={`Download ${attachment.filename}`}
                  >
                    <Download aria-hidden="true" />
                    Download
                  </a>
                </Button>
                {canDelete(attachment) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleting(attachment)}
                    aria-label={`Delete ${attachment.filename}`}
                  >
                    <Trash2 aria-hidden="true" />
                    Delete
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 border-t pt-4">
        <Label htmlFor={inputId}>Add an attachment</Label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            key={inputKey}
            id={inputId}
            type="file"
            accept={ALLOWED_EXTENSIONS.join(',')}
            onChange={handleChoose}
            disabled={atLimit || uploadAttachment.isPending}
            aria-describedby={hintId}
            aria-invalid={fileError ? true : undefined}
            className="sm:max-w-sm"
          />
          <div className="flex gap-2">
            <Button onClick={handleUpload} disabled={!file || Boolean(fileError) || uploadAttachment.isPending}>
              {uploadAttachment.isPending ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <Upload aria-hidden="true" />
              )}
              {uploadAttachment.isPending ? 'Uploading…' : 'Upload'}
            </Button>
            {file && !uploadAttachment.isPending && (
              <Button variant="ghost" onClick={resetPicker}>
                <X aria-hidden="true" />
                Clear
              </Button>
            )}
          </div>
        </div>
        <p id={hintId} className="text-sm text-muted-foreground">
          {atLimit
            ? `This task already has the maximum of ${MAX_ATTACHMENTS_PER_TASK} attachments. Delete one to add another.`
            : `Up to ${formatBytes(MAX_UPLOAD_BYTES)} each. Images, PDF, Word, Excel, PowerPoint, TXT, CSV and Markdown.`}
        </p>
        {file && !fileError && (
          <p className="text-sm">
            Selected: <span className="font-medium break-all">{file.name}</span> ({formatBytes(file.size)})
          </p>
        )}
        {uploadAttachment.isPending && (
          <p role="status" className="text-sm text-muted-foreground">
            Uploading “{file?.name}”… (the browser can't report upload progress for this request)
          </p>
        )}
        {fileError && (
          <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            {fileError}
          </p>
        )}
        {uploadError && (
          <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            {uploadError} Press Upload to try again.
          </p>
        )}
      </div>

      {deleting && (
        <DeleteAttachmentDialog
          taskId={task.id}
          attachment={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={(attachment) => {
            setDeleting(null)
            setUploaded(null)
            setDeleted(attachment.filename)
          }}
        />
      )}
    </div>
  )
}
