// Express HTTPS Application Entry Point & Route Mount
// Owner: Sanchit (Role 3 — Core Backend) & Swayam (Role 4 — Systems Integration & Proxy)

import express from 'express';
import http from 'http';
import https from 'https';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { serverConfig, loadSslCertificates, createViteReverseProxy, demoOrigins } from './config/server.config';
import { initDb } from './db/index';
import authRoutes from './routes/auth.routes';
import recoveryRoutes from './routes/recovery.routes';
import deviceRoutes from './routes/devices.routes';
import kioskRoutes from './routes/kiosk.routes';
import agentRoutes from './routes/agent.routes';
import adminRoutes from './routes/admin.routes';
import cryptoRoutes from './routes/crypto.routes';
import demoRoutes from './routes/demo.routes';

const app = express();

// Initialize SQLite database and frozen schema on startup
initDb();

// Base middleware
app.use(cors({
  origin: (requestOrigin, callback) => {
    if (!requestOrigin || [demoOrigins().bankOrigin, serverConfig.expectedOrigin].includes(requestOrigin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
}));
app.use(cookieParser());

// Healthcheck endpoint (supports both /health and /api/health)
const healthHandler = (req: express.Request, res: express.Response) => {
  res.json({
    status: 'HEALTHY',
    service: serverConfig.rpName,
    rpId: serverConfig.rpId,
    expectedOrigin: serverConfig.expectedOrigin,
    timestamp: new Date().toISOString(),
  });
};
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);
app.get('/api/demo/config', (_req, res) => res.json(demoOrigins()));

// JSON body parsing for API endpoints
app.use(express.json());

// Mount core identity routes (Sanchit - Role 3)
app.use('/api/auth', authRoutes);
app.use('/api/recovery', recoveryRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/kiosk', kioskRoutes);

// Mount agent delegation routes (Swayam - Role 4)
app.use('/api/agent', agentRoutes);

// Mount admin SOC routes (Swayam)
app.use('/api/admin', adminRoutes);

// Mount post-quantum cryptography & hardware key diagnostics (Swayam - Role 4)
app.use('/api/crypto', cryptoRoutes);
app.use('/api/demo', demoRoutes);

// Reverse-proxy all non-API requests to the internal Vite dev server (port 5173)
// This ensures that the citizen browser interacts solely with https://bank.local:3000
const viteProxy = createViteReverseProxy();
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  viteProxy(req, res, next);
});

// Start server: HTTPS if mkcert generated, otherwise HTTP with guidance
const ssl = loadSslCertificates();

if (ssl) {
  const httpsServer = https.createServer(ssl, app);
  httpsServer.listen(serverConfig.port, () => {
    console.log(`[TrustX SovereignPass] Secure HTTPS server running at https://${serverConfig.rpId}:${serverConfig.port}`);
    console.log(`[TrustX SovereignPass] WebAuthn RP_ID: ${serverConfig.rpId} | Origin: ${serverConfig.expectedOrigin}`);
    console.log(`[TrustX SovereignPass] Frontend reverse-proxied to internal Vite :${serverConfig.vitePort}`);
  });
} else {
  const httpServer = http.createServer(app);
  httpServer.listen(serverConfig.port, () => {
    console.log(`[TrustX SovereignPass] Dev HTTP server running at http://localhost:${serverConfig.port}`);
    console.log(`[TrustX SovereignPass] Note: SSL certs not found in certs/ directory.`);
    console.log(`[TrustX SovereignPass] To enable hardware passkey authentication: run mkcert to generate certs/cert.pem and certs/key.pem`);
  });
}

export default app;
