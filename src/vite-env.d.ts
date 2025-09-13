/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ANONYMOUS_API_URL: string
  readonly VITE_ANONYMOUS_API_KEY: string
  readonly DEV: boolean
  readonly PROD: boolean
  readonly MODE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
