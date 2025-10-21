import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

let wss: WebSocketServer | null = null;

// Initialize WebSocket server
export const initWebSocketServer = (server: HTTPServer): void => {
  wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket) => {
    console.log('🔌 New WebSocket client connected');

    ws.on('message', (message: string) => {
      console.log('📨 Received:', message.toString());
    });

    ws.on('close', () => {
      console.log('🔌 Client disconnected');
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
    });

    // Send welcome message
    ws.send(JSON.stringify({ type: 'connected', message: 'Connected to RestaurantPOS' }));
  });

  console.log('✅ WebSocket server initialized');
};

// Broadcast message to all connected clients
export const broadcast = (event: string, data: any): void => {
  if (!wss) {
    console.warn('⚠️ WebSocket server not initialized');
    return;
  }

  const message = JSON.stringify({ type: event, data });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });

  console.log(`📡 Broadcasted ${event} to ${wss.clients.size} clients`);
};

// WebSocket event types
export const WS_EVENTS = {
  ORDER_NEW: 'order:new',
  ORDER_UPDATE: 'order:update',
  ORDER_CANCEL: 'order:cancel',
  ORDER_STATUS_CHANGE: 'order:status',
  ORDER_SERVED: 'order:served',
  ORDER_DELETE: 'order:delete',
  GRILL_CLEAR: 'grill:clear',
  KITCHEN_CLEAR: 'kitchen:clear',
};
