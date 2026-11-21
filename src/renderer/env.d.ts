/// <reference types="vite/client" />
import type { KaliApi } from '../shared/types'

declare global {
  interface Window {
    kali: KaliApi
  }
}
