import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// `base` is required for GitHub Pages project sites: https://<user>.github.io/<repo>/
// Override at build time with: BASE_PATH=/your-repo/ npm run build
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH ?? '/lynxee/',
})
