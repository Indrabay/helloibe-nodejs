import 'dotenv/config';

import express from 'express';
import type { Request, Response } from 'express';
import { connectDatabase, closeDatabase } from './database';
import roleRoutes from './routes/roleRoutes';
import storeRoutes from './routes/storeRoutes';
import userRoutes from './routes/userRoutes';
import authRoutes from './routes/authRoutes';
import { requestIdMiddleware } from './middleware/requestId';

const app = express();

const port = process.env.PORT || 3000;

// Middleware
app.use(requestIdMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.send('OK');
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/users', userRoutes);

async function startServer() {
  try {
    await connectDatabase();

    app.listen(port, () => {
      console.log(`✅ Server is running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await closeDatabase();
  process.exit(0);
});

startServer();