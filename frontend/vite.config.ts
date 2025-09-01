import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file from parent directory (root)
  const env = loadEnv(mode, '../', '')
  
  // Detect if we're building for Electron or web
  const isElectron = env.VITE_TARGET === 'electron'
  
  return {
    plugins: [react()],
    base: isElectron ? './' : '/', // Use relative paths only for Electron
    envDir: '../', // Load environment variables from parent directory (root)
    // Expose specific non-VITE_ prefixed environment variables
    define: {
      'import.meta.env.BASIC_AUTH_USERNAME': JSON.stringify(env.BASIC_AUTH_USERNAME),
      'import.meta.env.BASIC_AUTH_PASSWORD': JSON.stringify(env.BASIC_AUTH_PASSWORD),
      'import.meta.env.IS_ELECTRON': JSON.stringify(isElectron),
    },
    server: {
      port: 5173,
      host: true,
      strictPort: true,
      proxy: {
        '/api-proxy': {
          target: 'http://95.111.244.159:8000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api-proxy/, '/api'),
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              // Add basic auth header
              const auth = Buffer.from('myca:wj2YyxrJ4cqcXgCA').toString('base64')
              proxyReq.setHeader('Authorization', `Basic ${auth}`)
            })
          }
        }
      }
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      // 🚀 STAGE 3 OPTIMIZATION: Enhanced build configuration
      target: 'esnext',
      minify: true,
      sourcemap: mode === 'development',
      rollupOptions: {
        output: {
          assetFileNames: 'assets/[name]-[hash][extname]',
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          // 🚀 STAGE 3 OPTIMIZATION: Manual chunk splitting for optimal loading
          manualChunks: {
            // Vendor libraries - loaded once, cached across routes
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            
            // Audio processing - separate chunk for audio-heavy features
            'audio-processing': [
              './src/lib/audioConfig.ts',
              './src/lib/audioCompression.ts', 
              './src/services/streamingUploader.ts'
            ],
            
            // Admin features - loaded only when needed
            'admin-features': [
              './src/features/admin',
              './src/components/queue'
            ],
            
            // Meeting features - core functionality
            'meeting-features': [
              './src/features/meetings/pages/Dashboard.tsx',
              './src/features/meetings/components',
              './src/features/meetings/pages/MeetingView.tsx'
            ],
            
            // Services and API - shared across components
            'services-api': [
              './src/services/api',
              './src/services/backgroundProcessor.ts',
              './src/stores'
            ],
            
            // Utils and shared components
            'shared-utils': [
              './src/components/common',
              './src/utils',
              './src/lib/constants.ts',
              './src/lib/types.ts',
              './src/lib/utils.ts'
            ]
          }
        },
        // 🚀 STAGE 3 OPTIMIZATION: Tree shaking and external optimization
        external: (id) => {
          // Mark large external dependencies for potential CDN loading
          return false // Keep all bundled for now, but this enables future CDN optimization
        }
      },
      // 🚀 STAGE 3 OPTIMIZATION: Chunk size optimization
      chunkSizeWarningLimit: 1000, // Warn for chunks > 1MB
      assetsInlineLimit: 4096 // Inline assets < 4KB as base64
    }
  }
})


