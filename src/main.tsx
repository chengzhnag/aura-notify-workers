import { enableMapSet } from "immer";
enableMapSet();
import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import '@/index.css'
import { HomePage } from '@/pages/HomePage'
import { NotificationTasksPage } from '@/pages/NotificationTasksPage'
import { NotificationChannelsPage } from '@/pages/NotificationChannelsPage'
import { TaskFormPage } from '@/pages/TaskFormPage'
import { ChannelFormPage } from '@/pages/ChannelFormPage'
import { TaskDetailsPage } from '@/pages/TaskDetailsPage'
import { HistoryPage } from '@/pages/HistoryPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { LoginPage } from '@/pages/LoginPage'
import { Toaster } from '@/components/ui/sonner';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/",
    element: <ProtectedRoute><HomePage /></ProtectedRoute>,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/tasks",
    element: <ProtectedRoute><NotificationTasksPage /></ProtectedRoute>,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/tasks/new",
    element: <ProtectedRoute><TaskFormPage /></ProtectedRoute>,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/tasks/:id",
    element: <ProtectedRoute><TaskDetailsPage /></ProtectedRoute>,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/tasks/:id/edit",
    element: <ProtectedRoute><TaskFormPage /></ProtectedRoute>,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/channels",
    element: <ProtectedRoute><NotificationChannelsPage /></ProtectedRoute>,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/channels/new",
    element: <ProtectedRoute><ChannelFormPage /></ProtectedRoute>,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/channels/:id/edit",
    element: <ProtectedRoute><ChannelFormPage /></ProtectedRoute>,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/history",
    element: <ProtectedRoute><HistoryPage /></ProtectedRoute>,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/settings",
    element: <ProtectedRoute><SettingsPage /></ProtectedRoute>,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  }
]);
createRoot(document.getElementById('root')!).render(
  <>
    <Toaster position="top-center" />
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <Suspense fallback={<div className="h-screen w-screen flex items-center justify-center"><div className="h-8 w-8 animate-spin border-4 border-primary border-t-transparent rounded-full" /></div>}>
            <RouterProvider router={router} />
          </Suspense>
        </ErrorBoundary>
      </QueryClientProvider>
    </StrictMode>
  </>,
)