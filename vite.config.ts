import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    port: 5174,
    strictPort: true,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
      "Cross-Origin-Embedder-Policy": "unsafe-none"
    }
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
            src: '/elephentlogo-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/elephentlogo-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          }
        ]
      },
      workbox: {
        // Yeni SW indirildiğinde eski SW'yi beklemeden hemen devreye al
        // Bu sayede auth güncellemesi kullanıcıya anında ulaşır
        skipWaiting: true,
        clientsClaim: true,
        // Önceden cache'lenecek dosya limitleri (Excel gibi dosyalar IndexedDB'de tutulacak, PWA sadece core app dosyalarını cache'lesin)
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
      }
    })
  ],
})
