import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import fs from 'fs'
import { generateFirebaseServiceWorkerContent } from './src/utils/firebase-sw-config'

// https://vitejs.dev/config/
// Custom plugin to generate Firebase messaging service worker
const firebaseServiceWorkerPlugin = () => {
  return {
    name: 'firebase-service-worker',
    buildStart() {
      // Generate Firebase service worker content
      const content = generateFirebaseServiceWorkerContent();
      
      // Write to public directory
      const publicDir = path.resolve(__dirname, 'public');
      const swPath = path.join(publicDir, 'firebase-messaging-sw.js');
      
      try {
        fs.writeFileSync(swPath, content);
        console.log('🔥 Generated firebase-messaging-sw.js');
      } catch (error) {
        console.warn('Failed to generate Firebase service worker:', error);
      }
    }
  };
};

export default defineConfig({
  plugins: [
    react(),
    firebaseServiceWorkerPlugin(),
    VitePWA({
      injectRegister: null, // avoid double registration; we register in src/main.tsx
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,vue,txt,woff2}'],
      },
      includeAssets: [
        'icons/favicon-16x16.png',
        'icons/favicon-32x32.png',
        'icons/icon-180x180.png',
        'icons/icon-192x192.png',
        'icons/icon-256x256.png',
        'icons/icon-384x384.png',
        'icons/icon-512x512.png'
      ],
      manifest: {
        name: 'Meditrax - Medication Tracker',
        short_name: 'Meditrax',
        description: 'Comprehensive medication tracking and management application',
        theme_color: '#3b82f6',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icons/icon-256x256.png',
            sizes: '256x256',
            type: 'image/png'
          },
          {
            src: 'icons/icon-384x384.png',
            sizes: '384x384',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          charts: ['recharts', 'd3'],
          utils: ['date-fns', 'clsx', 'tailwind-merge'],
        },
      },
    },
  },
  base: '/', // Use root path for custom domain
})
