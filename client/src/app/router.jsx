import { createBrowserRouter } from 'react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { GuestRoute, ProtectedRoute } from '@/features/auth/AuthGuards'
import { TasksPage } from '@/pages/TasksPage'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

export const routes = [
  {
    element: <AppLayout />,
    children: [
      // Signed-out only: signed-in users are redirected away.
      {
        element: <GuestRoute />,
        children: [
          { path: 'login', element: <LoginPage /> },
          { path: 'register', element: <RegisterPage /> },
        ],
      },
      // Signed-in only: signed-out users are redirected to /login.
      {
        element: <ProtectedRoute />,
        children: [
          { index: true, element: <TasksPage view="list" /> },
          { path: 'board', element: <TasksPage view="board" /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
