import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Default entry points are used:
//   main     -> src/main/index.ts
//   preload  -> src/preload/index.ts
//   renderer -> src/renderer/index.html
export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    plugins: [react(), tailwindcss()]
  }
})
