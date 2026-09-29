import type { AppEdition } from '@shared/types/appEdition'

declare global {
  const __APP_EDITION__: AppEdition

  interface ImportMetaEnv {
    readonly MAIN_VITE_ASTRA-API_CLIENT_SECRET: string
    readonly MAIN_VITE_ASTRA_CLOUD_CLIENT_SECRET?: string
    readonly MAIN_VITE_ASTRA_CLOUD_API_ORIGIN?: string
  }
}
