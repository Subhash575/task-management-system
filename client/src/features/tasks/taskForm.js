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
}

export const FORM_FIELDS = ['title', 'description', 'status', 'priority', 'labels', 'dueDate']

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

/** The request body for POST /api/tasks. No creator (the server uses the session) and no assignee yet. */
export function buildCreatePayload(values) {
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    status: values.status,
    priority: values.priority,
    labels: parseLabels(values.labels),
    dueDate: values.dueDate || null, // <input type="date"> gives "YYYY-MM-DD", which the API accepts
  }
}
