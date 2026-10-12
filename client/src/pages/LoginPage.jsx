import { useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Link } from 'react-router'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useLogin } from '@/features/auth/auth'
import { AuthCard, authLinkClass, authSubmitClass } from '@/features/auth/AuthCard'
import { FormField } from '@/features/auth/FormField'
import { fieldErrorsFromApiError, validateLogin } from '@/features/auth/validation'

const FIELDS = ['email', 'password']

export function LoginPage() {
  const [values, setValues] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const login = useLogin()

  const update = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value }))

  function handleSubmit(event) {
    event.preventDefault()
    const clientErrors = validateLogin(values)
    setErrors(clientErrors)
    if (Object.keys(clientErrors).length > 0) return

    // On success the session is cached and GuestRoute redirects away, so nothing else to do here.
    login.mutate(
      { email: values.email.trim(), password: values.password },
      { onError: (error) => setErrors(fieldErrorsFromApiError(error, FIELDS)) },
    )
  }

  // Field errors are shown inline; anything else (wrong password, 429, network) goes in the alert.
  const formError = login.isError && Object.keys(errors).length === 0 ? login.error.message : null

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to continue to your workspace."
      footer={
        <p>
          New here?{' '}
          <Link to="/register" className={authLinkClass}>
            Create an account
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
          autoComplete="current-password"
          value={values.password}
          onChange={update('password')}
          error={errors.password}
        />
        <Button type="submit" className={authSubmitClass} disabled={login.isPending}>
          {login.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
          {login.isPending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthCard>
  )
}
