import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { AssigneeField } from './AssigneeField'
import { Field } from './Field'
import { LIMITS } from './taskForm'
import { TASK_PRIORITIES, TASK_STATUSES } from './tasks'

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
 * The shared task fields. With `statusOnly` (assignees may only change the status) just the status is shown,
 * so assignees never get a control for fields they are not allowed to change.
 * `currentAssignee` is the task's existing assignee when editing.
 */
export function TaskFormFields({ values, errors, update, statusOnly = false, currentAssignee = null }) {
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

      <div className="grid items-start gap-4 sm:grid-cols-2">
        <Field label="Due date" error={errors.dueDate}>
          {(props) => <Input {...props} type="date" value={values.dueDate} onChange={update('dueDate')} />}
        </Field>
        <AssigneeField
          value={values.assignee}
          onChange={update('assignee')}
          error={errors.assignee}
          currentAssignee={currentAssignee}
        />
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
