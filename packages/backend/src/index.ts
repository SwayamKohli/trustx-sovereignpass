import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { origin } from './webauthn/config';
import { initDb } from './db/index';

const app = express();
const PORT = process.env.PORT || 3000;

// Base middleware
app.use(cors({ origin, credentials: true }));
app.use(cookieParser());
app.use(express.json());

// Initialize SQLite database and schema on startup
initDb();

// Minimal Express server with GET /health route
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Also support /api/health for team convention
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[TrustX Backend] Server running on port ${PORT}`);
  });
}

export default app;
