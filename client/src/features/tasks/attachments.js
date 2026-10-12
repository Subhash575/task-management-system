import { useMutation, useQueryClient } from '@tanstack/react-query'
import { API_BASE_URL, apiRequest } from '@/lib/api'
import { taskKeys } from './tasks'

// Must match the server's rules (server/src/utils/fileValidation.js). The server checks them again.
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
export const MAX_ATTACHMENTS_PER_TASK = 10
export const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf', '.docx', '.xlsx', '.pptx', '.txt', '.csv', '.md']

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Returns an error message, or null when the file looks acceptable. */
export function validateFile(file) {
  const name = file.name.toLowerCase()
  const extension = name.includes('.') ? name.slice(name.lastIndexOf('.')) : ''
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return `This file type is not supported. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`
  }
  if (file.size === 0) return 'The file is empty'
  if (file.size > MAX_UPLOAD_BYTES) {
    return `The file is too large (${formatBytes(file.size)}). The maximum is ${formatBytes(MAX_UPLOAD_BYTES)}`
  }
  return null
}

/** The download is a plain link: the browser sends the session cookie and saves the file. */
export function attachmentDownloadUrl(taskId, attachmentId) {
  return `${API_BASE_URL}/tasks/${taskId}/attachments/${attachmentId}/download`
}

// Attachments are part of the task detail response, so refreshing every task query keeps everything in sync.
export function useUploadAttachment(taskId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (file) => {
      const body = new FormData()
      body.append('file', file)
      return apiRequest(`/tasks/${taskId}/attachments`, { method: 'POST', body })
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: taskKeys.all }),
  })
}

export function useDeleteAttachment(taskId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (attachmentId) => apiRequest(`/tasks/${taskId}/attachments/${attachmentId}`, { method: 'DELETE' }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: taskKeys.all }),
  })
}
