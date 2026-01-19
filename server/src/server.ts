import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { emailQueue } from './workers/emailWorker';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Participants routes will be added here
app.get('/api/participants', (req, res) => {
  // Placeholder - will implement
  res.json([]);
});

app.post('/api/participants', (req, res) => {
  // Placeholder - will implement
  res.status(201).json({ message: 'Participant created' });
});

// Campaigns routes will be added here
app.get('/api/campaigns', (req, res) => {
  // Placeholder - will implement
  res.json([]);
});

app.post('/api/campaigns', (req, res) => {
  // Placeholder - will implement
  res.status(201).json({ message: 'Campaign created' });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await emailQueue.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await emailQueue.close();
  process.exit(0);
});