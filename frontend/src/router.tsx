import { createRouter, createRootRoute, createRoute } from '@tanstack/react-router'
import AppLayout from '@/layouts/AppLayout'
import Dashboard from '@/pages/Dashboard'
import Transactions from '@/pages/Transactions'
import Accounts from '@/pages/Accounts'
import AccountDetails from '@/pages/AccountDetails'
import Settings from '@/pages/Settings'

// Root layout route
const rootRoute = createRootRoute({
  component: AppLayout,
})

// Page routes
const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Dashboard,
})

const transactionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/transactions',
  component: Transactions,
})

const accountsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/accounts',
  component: Accounts,
})

const accountDetailsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/accounts/$accountId',
  component: () => {
    // Lazy load or import directly. We will import directly above.
    return <AccountDetails />
  }
})

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: Settings,
})

// Build the route tree
const routeTree = rootRoute.addChildren([
  dashboardRoute,
  transactionsRoute,
  accountsRoute,
  accountDetailsRoute,
  settingsRoute,
])

export const router = createRouter({ routeTree })

// Register router for type-safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
