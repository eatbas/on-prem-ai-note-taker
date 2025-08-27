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
      rollupOptions: {
        output: {
          assetFileNames: 'assets/[name]-[hash][extname]',
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
        }
      }
    }
  }
})


