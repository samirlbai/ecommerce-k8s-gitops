
// vite.config.js

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 8080,
    host: '0.0.0.0',
    cors: true,
    proxy: {
      '/api/products': {
        target: process.env.VITE_PRODUCT_SERVICE_URL || 'http://product-service:3000',
        changeOrigin: true,
        
      },
      '/api/cart': {
        target: process.env.VITE_PRODUCT_SERVICE_URL || 'http://product-service:3000',
        changeOrigin: true,
        
      },
      '/api/auth': {
        target: process.env.VITE_AUTH_SERVICE_URL || 'http://auth-service:3001',
        changeOrigin: true,
        timeout: 60000, // 60 secondes
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            console.log(`[VITE PROXY] Proxying request to: ${proxyReq.path}`);
          });
          proxy.on('proxyRes', (proxyRes, req) => {
            console.log(`[VITE PROXY] Response received with status: ${proxyRes.statusCode}`);
          });
          proxy.on('error', (err) => {
            console.error(`[VITE PROXY] Proxy error: ${err.message}`);
          });
        },
      },
      '/api/orders': {
        target: process.env.VITE_ORDER_SERVICE_URL || 'http://order-service:3002',
        changeOrigin: true,
        
      }
    }
  }
})
