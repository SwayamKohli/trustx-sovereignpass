// Express HTTPS Application Entry Point & Route Mount
// Owner: Sanchit (Role 3 — Core Backend) & Swayam (Role 4 — Systems Integration & Proxy)

import express from 'express';
import http from 'http';
import https from 'https';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { serverConfig, loadSslCertificates, createViteReverseProxy } from './config/server.config';
import { initDb } from './db/index';
import authRoutes from './routes/auth.routes';
import agentRoutes from './routes/agent.routes';

const app = express();

// Initialize SQLite database and frozen schema on startup
initDb();

// Base middleware
app.use(cors({ origin: serverConfig.expectedOrigin, credentials: true }));
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

// JSON body parsing for API endpoints
app.use(express.json());

// Mount authentication routes (Sanchit)
app.use('/api/auth', authRoutes);

// Mount agent delegation routes (Swayam)
app.use('/api/agent', agentRoutes);

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
