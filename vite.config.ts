import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// TOPIK MASTER 2027 — T0
// 静态 PWA，无后端。vite-plugin-pwa 生成 Service Worker，离线可打开首页。
export default defineConfig({
  // GitHub Pages 部署在子路径 /topik-master-2027/ 下，base 必须对应，否则资源 404。
  base: '/topik-master-2027/',
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
        // 注意：部署在子路径 /topik-master-2027/ 下，start_url 与图标必须带子路径，
        // 写根路径 '/' 会在 Pages 上 404，“添加到主屏幕”拿不到图标。
        start_url: '/topik-master-2027/',
        display: 'standalone',
        background_color: '#fff7f0',
        theme_color: '#d7929f',
        icons: [
          { src: '/topik-master-2027/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/topik-master-2027/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        // 主 chunk 含六批内置种子（7,605 条），打包后约 2.3 MB，超过 workbox 默认 2 MiB
        // 预缓存上限；种子是离线可用的核心数据，必须进预缓存，故上限提到 3 MiB。
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        // 首页与静态资源离线可用；学习数据在 IndexedDB，不走网络缓存。
        navigateFallback: 'index.html',
      },
    }),
  ],
})
