import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// TOPIK MASTER 2027 — T0
// 静态 PWA，无后端。vite-plugin-pwa 生成 Service Worker，离线可打开首页。
export default defineConfig({
  // Cloudflare Pages 测试站部署在根路径下（<项目>.pages.dev），base 必须为 '/'。
  // 注意：main 分支的 GitHub Pages 版仍用 '/topik-master-2027/'，两条线配置各自独立，互不影响。
  base: '/',
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
        // 测试站部署在根路径下，start_url 与图标用根路径。
        start_url: '/',
        display: 'standalone',
        background_color: '#F8F8F6',
        theme_color: '#E0E8F0',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,webmanifest}'],
        // 词库种子拆为按需加载的 JS 文件。保留在预缓存中，首次离线也能从缓存导入种子。
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        // 首页与静态资源离线可用；学习数据在 IndexedDB，不走网络缓存。
        navigateFallback: 'index.html',
      },
    }),
  ],
})
