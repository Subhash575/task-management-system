import { useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Link } from 'react-router'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useRegister } from '@/features/auth/auth'
import { AuthCard, authLinkClass, authSubmitClass } from '@/features/auth/AuthCard'
import { FormField } from '@/features/auth/FormField'
import { fieldErrorsFromApiError, validateRegister } from '@/features/auth/validation'

const FIELDS = ['name', 'email', 'password', 'confirmPassword']

export function RegisterPage() {
  const [values, setValues] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [errors, setErrors] = useState({})
  const register = useRegister()

  const update = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value }))

  function handleSubmit(event) {
    event.preventDefault()
    const clientErrors = validateRegister(values)
    setErrors(clientErrors)
    if (Object.keys(clientErrors).length > 0) return

    register.mutate(
      {
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password,
        confirmPassword: values.confirmPassword,
      },
      {
        onError: (error) => {
          // A 409 means the email is taken, so show it next to the email field.
          setErrors(error.status === 409 ? { email: error.message } : fieldErrorsFromApiError(error, FIELDS))
        },
      },
    )
  }

  const formError = register.isError && Object.keys(errors).length === 0 ? register.error.message : null

  return (
    <AuthCard
      title="Create your account"
      description="Get started with TaskFlow."
      footer={
        <p>
          Already have an account?{' '}
          <Link to="/login" className={authLinkClass}>
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        {formError && (
          <Alert variant="destructive">
            <AlertCircle aria-hidden="true" />
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
        <FormField label="Full name" placeholder="Ada Lovelace" autoComplete="name" value={values.name} onChange={update('name')} error={errors.name} />
        <FormField
          label="Email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          value={values.email}
          onChange={update('email')}
          error={errors.email}
        />
        <FormField
          label="Password"
          type="password"
          autoComplete="new-password"
          value={values.password}
          onChange={update('password')}
          error={errors.password}
        />
        <FormField
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={update('confirmPassword')}
          error={errors.confirmPassword}
        />
        <Button type="submit" className={authSubmitClass} disabled={register.isPending}>
          {register.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
          {register.isPending ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthCard>
  )
}
