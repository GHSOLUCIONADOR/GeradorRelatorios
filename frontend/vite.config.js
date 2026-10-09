import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['img/LOGO.png', 'img/ICON.png'],
      manifest: {
        name: 'GHRelatórios',
        short_name: 'GHRelatórios',
        description: 'Sistema de Documentos e Relatórios',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'img/ICON.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'img/ICON.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'img/ICON.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  server: {
    port: 5180,
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_TARGET || 'https://geradorrelatorios-git-1086248605321.us-east1.run.app',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
