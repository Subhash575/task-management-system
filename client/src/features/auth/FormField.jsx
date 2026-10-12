import { useId, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Label + input + inline error, wired together for screen readers (aria-invalid / aria-describedby).
 * Password fields get a show/hide toggle; it only changes the input type and never stores the value anywhere.
 */
export function FormField({ label, error, type, ...inputProps }) {
  const id = useId()
  const errorId = `${id}-error`
  const [revealed, setRevealed] = useState(false)
  const isPassword = type === 'password'

  const input = (
    <Input
      id={id}
      type={isPassword && revealed ? 'text' : type}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
      {...inputProps}
      className={`h-10 ${isPassword ? 'pr-10' : ''}`}
    />
  )

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-slate-800 dark:text-slate-100">
        {label}
      </Label>
      {isPassword ? (
        <div className="relative">
          {input}
          <button
            type="button"
            onClick={() => setRevealed((current) => !current)}
            aria-pressed={revealed}
            aria-label={revealed ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-slate-500 outline-none hover:text-slate-900 focus-visible:ring-[3px] focus-visible:ring-indigo-500/50 dark:hover:text-slate-100"
          >
            {revealed ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
          </button>
        </div>
      ) : (
        input
      )}
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
