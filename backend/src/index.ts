import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import http from 'http';
import authRoutes from './routes/auth';
import menuRoutes from './routes/menu';
import ordersRoutes from './routes/orders';
import { initWebSocketServer } from './websocket/server';

// Load environment variables
dotenv.config();

// Initialize Express app
const app: Application = express();
const PORT = process.env.PORT || 5000;

// Initialize Prisma Client
export const prisma = new PrismaClient();

// Middleware
app.use(cors()); //TODO remove later 
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check / ping endpoint
app.get('/ping', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok',
    message: 'RestaurantPOS Backend is running',
    timestamp: new Date().toISOString()
  });
});

// Test database connection endpoint
app.get('/api/health', async (req: Request, res: Response) => {
  try {
    // Test database connection
    await prisma.$connect();
    res.json({ 
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error',
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API Routes
app.use('/auth', authRoutes);
app.use('/menu', menuRoutes);
app.use('/orders', ordersRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ 
    status: 'error',
    message: 'Route not found'
  });
});

// Create HTTP server and initialize WebSocket
const server = http.createServer(app);
initWebSocketServer(server);

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 RestaurantPOS Backend running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔌 WebSocket server ready`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(async () => {
    await prisma.$disconnect();
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(async () => {
    await prisma.$disconnect();
    console.log('HTTP server closed');
    process.exit(0);
  });
});
