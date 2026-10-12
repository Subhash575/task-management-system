import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card'

export function AuthCard({ title, description, footer, children }) {
  return (
    <div className="mx-auto w-full max-w-md py-4 sm:py-10">
      <Card>
        <CardHeader>
          <h1 className="text-2xl leading-none font-semibold">{title}</h1>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
        <CardFooter className="justify-center text-sm text-muted-foreground">{footer}</CardFooter>
      </Card>
    </div>
  )
}
