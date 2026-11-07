import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// TOPIK MASTER 2027 — T0
// 静态 PWA，无后端。vite-plugin-pwa 生成 Service Worker，离线可打开首页。
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'TOPIK MASTER 2027',
        short_name: 'TOPIK 2027',
        description: '个人韩语 TOPIK 备考系统（本地优先）',
        lang: 'zh-CN',
        start_url: '/',
        display: 'standalone',
        background_color: '#fff7f0',
        theme_color: '#d7929f',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        // 首页与静态资源离线可用；学习数据在 IndexedDB，不走网络缓存。
        navigateFallback: 'index.html',
      },
    }),
  ],
})
