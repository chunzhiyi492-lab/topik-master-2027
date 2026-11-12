import { defineConfig } from '@playwright/test'

const baseURL = 'http://127.0.0.1:4180/topik-master-2027/'

export default defineConfig({
  testDir: './tests/pwa',
  outputDir: './playwright-report/pwa-results',
  workers: 1,
  use: { baseURL, channel: process.env.TOPIK_TEST_BROWSER || undefined },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4180 --strictPort',
    url: baseURL,
    reuseExistingServer: false,
  },
})
