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
      registerType: 'autoUpdate',
      strategies: 'generateSW',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,vue,txt,woff2}'],
        additionalManifestEntries: [
          { url: '/firebase-messaging-sw.js', revision: null },
          { url: '/notification-sw.js', revision: null }
        ],
        runtimeCaching: [
          // Network-first strategy for main app assets (HTML, JS, CSS) to ensure updates
          {
            urlPattern: /.*\.(js|css|html)$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'app-shell-cache',
              networkTimeoutSeconds: 3, // Fast timeout to fall back to cache when offline
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              }
            }
          },
          // Network-first for the root document to ensure latest version
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages-cache',
              networkTimeoutSeconds: 3
            }
          },
          // Cache-first for fonts (these rarely change)
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 365 days
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 365 days
              }
            }
          },
          // Cache-first for images and static assets (with cache busting)
          {
            urlPattern: /.*\.(png|jpg|jpeg|svg|gif|webp|ico)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          }
        ],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        importScripts: ['/notification-sw.js']
      },
      includeAssets: ['pill-icon.svg'],
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
            src: 'pill-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml'
          },
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
