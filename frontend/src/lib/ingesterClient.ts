import axios from 'axios'
import { getUserManager } from '@adolf94/ar-auth-client'

/**
 * Axios client for direct calls to the Python notif-ingester.
 * Used for endpoints where the .NET backend is a pure passthrough
 * (e.g. reclassify), so the frontend calls Python directly with a JWT Bearer.
 */
const ingesterClient = axios.create({
  baseURL:
    (window as any).authConfig?.ingesterBaseUrl ??
    import.meta.env.VITE_INGESTER_BASE_URL ??
    'http://localhost:7072',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Attach the user's JWT Bearer token to every ingester request
ingesterClient.interceptors.request.use(async (config) => {
  let token = localStorage.getItem('access_token')
  if (!token) {
    try {
      const userManager = getUserManager()
      const user = await userManager.getUser()
      if (user && user.access_token) {
        token = user.access_token
      }
    } catch {
      const authority =
        (window as any).authConfig?.authority ?? 'https://auth.adolfrey.com/api'
      const clientId = (window as any).authConfig?.clientId ?? 'finance-app2'
      const authorityBase = authority.endsWith('/') ? authority : `${authority}/`
      const keys = [
        `oidc.user:${authorityBase}:${clientId}`,
        `oidc.user:${authority}:${clientId}`,
      ]
      for (const key of keys) {
        const oidcData = localStorage.getItem(key)
        if (oidcData) {
          try {
            const parsed = JSON.parse(oidcData)
            if (parsed?.access_token) {
              token = parsed.access_token
              break
            }
          } catch (err) {
            console.error(err)
          }
        }
      }
    }
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

ingesterClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default ingesterClient
