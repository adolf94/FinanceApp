import axios from 'axios'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:7071/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Auth interceptor: attach Bearer token to every request
apiClient.interceptors.request.use((config) => {
  let token = localStorage.getItem('access_token')
  if (!token) {
    const keys = [
      'oidc.user:https://auth.adolfrey.com/:finance-app2',
      'oidc.user:https://auth.adolfrey.com/api:finance-app2'
    ]
    for (const key of keys) {
      const oidcData = localStorage.getItem(key)
      if (oidcData) {
        try {
          const parsed = JSON.parse(oidcData)
          if (parsed && parsed.access_token) {
            token = parsed.access_token
            break
          }
        } catch (e) {
          console.error(e)
        }
      }
    }
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Global error response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or unauthorized — redirect to login
      localStorage.removeItem('access_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default apiClient
