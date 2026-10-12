import { ApiError } from '@/lib/api'
import { TASK_PRIORITIES, TASK_STATUSES } from './tasks'

// Limits mirror server/src/validation/task.schemas.js.
export const LIMITS = { title: 200, description: 5000, labels: 10, label: 30 }

export const INITIAL_FORM = {
  title: '',
  description: '',
  status: 'To Do',
  priority: 'Medium',
  labels: '',
  dueDate: '',
  assignee: '', // user id, or '' for unassigned
}

export const FORM_FIELDS = ['title', 'description', 'status', 'priority', 'labels', 'dueDate', 'assignee']

/** "bug, UI, bug" -> ['bug', 'UI'] (trimmed, empty entries dropped, case-insensitive de-duplication). */
export function parseLabels(text) {
  const labels = text
    .split(',')
    .map((label) => label.trim())
    .filter(Boolean)
  return labels.filter((label, i) => labels.findIndex((l) => l.toLowerCase() === label.toLowerCase()) === i)
}

export function validateTaskForm(values) {
  const errors = {}
  const title = values.title.trim()
  if (!title) errors.title = 'Title is required'
  else if (title.length > LIMITS.title) errors.title = `Title must be at most ${LIMITS.title} characters`

  if (values.description.trim().length > LIMITS.description)
    errors.description = `Description must be at most ${LIMITS.description} characters`

  if (!TASK_STATUSES.includes(values.status)) errors.status = 'Choose a valid status'
  if (!TASK_PRIORITIES.includes(values.priority)) errors.priority = 'Choose a valid priority'

  const labels = parseLabels(values.labels)
  if (labels.length > LIMITS.labels) errors.labels = `Use at most ${LIMITS.labels} labels`
  else if (labels.some((label) => label.length > LIMITS.label))
    errors.labels = `Each label must be at most ${LIMITS.label} characters`

  return errors
}

/** The request body for POST /api/tasks. No creator: the server takes it from the session. */
export function buildCreatePayload(values) {
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    status: values.status,
    priority: values.priority,
    labels: parseLabels(values.labels),
    dueDate: values.dueDate || null, // <input type="date"> gives "YYYY-MM-DD", which the API accepts
    assignee: values.assignee || null, // null = unassigned; the server checks that the user exists
  }
}

/** Form values for editing: the due date is shown as the UTC calendar day, as the API stores it. */
export function taskToFormValues(task) {
  return {
    title: task.title,
    description: task.description ?? '',
    status: task.status,
    priority: task.priority,
    labels: task.labels.join(', '),
    dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
    assignee: task.assignee?.id ?? '',
  }
}

/**
 * The PATCH body: only fields that actually changed, so an untouched field (or one the user may not edit)
 * is never re-sent. `statusOnly` is for assignees, who may only change the status. Never includes creator.
 */
export function buildUpdatePayload(task, values, { statusOnly = false } = {}) {
  const changes = {}
  if (values.status !== task.status) changes.status = values.status
  if (statusOnly) return changes

  const full = buildCreatePayload(values)
  if (full.title !== task.title) changes.title = full.title
  if (full.description !== (task.description ?? '')) changes.description = full.description
  if (full.priority !== task.priority) changes.priority = full.priority
  if (JSON.stringify(full.labels) !== JSON.stringify(task.labels)) changes.labels = full.labels
  if (full.dueDate !== (task.dueDate ? task.dueDate.slice(0, 10) : null)) changes.dueDate = full.dueDate
  if (full.assignee !== (task.assignee?.id ?? null)) changes.assignee = full.assignee
  return changes
}


/** Server messages for 4xx are safe to show; anything else gets a generic message. */
export function describeError(error) {
  if (error instanceof ApiError && error.status < 500) return error.message
  if (error instanceof ApiError) return 'Something went wrong on our side. Please try again.'
  return 'Could not reach the server. Check your connection and try again.'
}

/** Splits an API error into `{ fieldErrors, formError }`: field messages go next to the field, the rest in an alert. */
export function splitServerError(error) {
  const fieldErrors = {}
  for (const detail of error.details ?? []) {
    if (FORM_FIELDS.includes(detail.path) && !fieldErrors[detail.path]) fieldErrors[detail.path] = detail.message
  }
  return { fieldErrors, formError: Object.keys(fieldErrors).length === 0 ? describeError(error) : null }
}
