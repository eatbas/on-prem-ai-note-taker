import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file from parent directory (root)
  const env = loadEnv(mode, '../', '')
  
  return {
    plugins: [react()],
    base: './', // Use relative paths for Electron
    envDir: '../', // Load environment variables from parent directory (root)
    // Expose specific non-VITE_ prefixed environment variables
    define: {
      'import.meta.env.BASIC_AUTH_USERNAME': JSON.stringify(env.BASIC_AUTH_USERNAME),
      'import.meta.env.BASIC_AUTH_PASSWORD': JSON.stringify(env.BASIC_AUTH_PASSWORD),
    },
    server: {
      port: 5173,
      host: true,
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


