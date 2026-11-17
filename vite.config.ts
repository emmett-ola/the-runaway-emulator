import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  const host = env.VITE_HOST || '0.0.0.0'
  const port = parseInt(env.VITE_PORT || '5173')
  const hmrHost = env.VITE_HMR_HOST
  const hmrPort = parseInt(env.VITE_HMR_PORT || '443')
  const hmrProtocol = env.VITE_HMR_PROTOCOL || 'wss'

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'icon-192.png', 'icon-512.png'],
        manifest: {
          name: 'RunawayLog',
          short_name: 'RunawayLog',
          description: 'Track your desire to escape the daily grind',
          theme_color: '#4CAF50',
          background_color: '#ffffff',
          display: 'standalone',
          icons: [
            {
              src: 'icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable'
            },
            {
              src: 'icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        }
      })
    ],
    server: {
      host,
      port,
      allowedHosts: [
        hmrHost,
        '.gitpod.dev',
        '.github.dev',
        'localhost',
      ].filter(Boolean),
      hmr: hmrHost ? {
        protocol: hmrProtocol,
        host: hmrHost,
        clientPort: hmrPort,
      } : true,
    },
    test: {
      exclude: ['**/node_modules/**', '**/.git/**', '**/.claude/worktrees/**'],
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      // The storage tests commit real generations and the identity tests run PBKDF2; under
      // full-suite parallelism the default 5s limit produced load-dependent flakes
      // (verified: same suite, one green run, one red run). A 20s ceiling removes the
      // timeout race; a genuine hang still fails.
      testTimeout: 20_000,
      // Files share process-global storage state (fake IndexedDB + the storage singleton), and
      // running them in parallel made `settings-header-import` fail with the import dialog
      // missing (verified: parallel = 1 failure, sequential = 577/577). Run files sequentially
      // until the isolation defect is fixed; see spec/roadmap.md.
      fileParallelism: false,
    },
  }
})
