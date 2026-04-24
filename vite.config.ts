import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true
      },
      manifest: {
        name: 'ClassApp - Öğretmen Asistanı',
        short_name: 'ClassApp',
        description: 'Çevrimdışı öğrenci listeleri ve oturma planı uygulaması',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone'
      },
      workbox: {
        // Önceden cache'lenecek dosya limitleri (Excel gibi dosyalar IndexedDB'de tutulacak, PWA sadece core app dosyalarını cache'lesin)
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
      }
    })
  ],
})
