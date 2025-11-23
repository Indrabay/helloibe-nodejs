import 'dotenv/config';

import express from 'express';
import type { Request, Response } from 'express';
import { connectDatabase, closeDatabase } from './database';

const app = express();

const port = process.env.PORT || 3000;

app.get('/health', (req: Request, res: Response) => {
  res.send('OK');
});

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