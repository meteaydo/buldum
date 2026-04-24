import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    port: 5174,
    strictPort: true,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true
      },
      manifest: {
        name: 'BulGetir',
        short_name: 'BulGetir',
        description: 'Çevrimdışı öğrenci listeleri ve oturma planı uygulaması',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/elephentlogo.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/elephentlogo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // Önceden cache'lenecek dosya limitleri (Excel gibi dosyalar IndexedDB'de tutulacak, PWA sadece core app dosyalarını cache'lesin)
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
      }
    })
  ],
})
