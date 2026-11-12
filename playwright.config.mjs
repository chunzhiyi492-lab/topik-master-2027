import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  testIgnore: '**/pwa/**',
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4178/topik-master-2027/',
    channel: process.env.TOPIK_TEST_BROWSER || undefined,
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4178 --strictPort',
    url: 'http://127.0.0.1:4178/topik-master-2027/',
    reuseExistingServer: false,
  },
})
