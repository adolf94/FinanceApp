/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  authConfig?: {
    authority: string
    clientId: string
    redirectUri: string
    scope: string
    apiBaseUrl: string
  }
}
