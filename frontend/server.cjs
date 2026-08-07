// frontend/server.cjs

const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
app.use((req, res, next) => {
  console.log(`[FRONTEND SERVER] Incoming request: ${req.method} ${req.url}`);
  next();
});
// 1. Servir les fichiers statiques du dossier 'dist'
app.use(express.static(path.join(__dirname, 'dist')));

// 2. Proxy des requêtes API vers les services backend

// Proxy Auth Service
app.use('/api/auth', createProxyMiddleware({
  target: process.env.VITE_AUTH_SERVICE_URL || 'http://127.0.0.1:3001',
  changeOrigin: true,
  logLevel: 'debug',
  pathRewrite: (path, req) => {
    // Restaurer le chemin complet
    return '/api/auth' + req.url;
  },
  onError: (err, req, res) => {
    console.error(`[PROXY ERROR - Auth] ${err.message}`);
    res.status(500).send('Proxy error (auth-service)');
  },
  onProxyReq: (proxyReq, req) => {
    console.log(`[PROXY - Auth] Forwarding request: ${req.method} ${req.url}`);
  },
  onProxyRes: (proxyRes, req) => {
    console.log(`[PROXY - Auth] Response status: ${proxyRes.statusCode}`);
  },
}));

// Product Service
app.use('/api/products', createProxyMiddleware({
  target: process.env.VITE_PRODUCT_SERVICE_URL || 'http://127.0.0.1:3000',
  changeOrigin: true,
  logLevel: 'debug',
  onProxyReq: (proxyReq, req) => {
    console.log(`[PROXY] Forwarding request to product-service: ${req.method} ${req.url}`);
  },
  onProxyRes: (proxyRes, req) => {
    console.log(`[PROXY] Response from product-service: ${proxyRes.statusCode}`);
  },
  pathRewrite: (path, req) => {
    // Restaurer le chemin complet
    return '/api/products' + req.url;
  },
}));

// Order Service
app.use('/api/orders', createProxyMiddleware({
  target: process.env.VITE_ORDER_SERVICE_URL || 'http://127.0.0.1:3002',
  changeOrigin: true,
  logLevel: 'debug',
  onProxyReq: (proxyReq, req) => {
    console.log(`[PROXY] Forwarding request to order-service: ${req.method} ${req.url}`);
  },
  onProxyRes: (proxyRes, req) => {
    console.log(`[PROXY] Response from order-service: ${proxyRes.statusCode}`);
  },
  pathRewrite: (path, req) => {
    // Restaurer le chemin complet
    return '/api/orders' + req.url;
  },
}));

// Cart Service
app.use('/api/cart', createProxyMiddleware({
  target: process.env.VITE_PRODUCT_SERVICE_URL || 'http://127.0.0.1:3000',
  changeOrigin: true,
  logLevel: 'debug',
  onProxyReq: (proxyReq, req) => {
    console.log(`[PROXY] Forwarding request to cart-service: ${req.method} ${req.url}`);
  },
  onProxyRes: (proxyRes, req) => {
    console.log(`[PROXY] Response from cart-service: ${proxyRes.statusCode}`);
  },
  pathRewrite: (path, req) => {
    // Restaurer le chemin complet
    return '/api/cart' + req.url;
  },
}));

// 3. Pour les routes non gérées, renvoyer index.html (SPA)
app.get('*', (req, res) => {
  if (req.originalUrl.startsWith('/api/') || req.originalUrl.includes('.')) {
    res.status(404).send('Not Found');
  } else {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  }
});

// 4. Démarrer le serveur
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Frontend server is running on port ${PORT}`);
});