import { io, type Socket } from 'socket.io-client';
import { SOCKET_URL } from './config';
import { getAccessToken } from './api';

let socket: Socket | null = null;
let lastUserId: string | null = null;

/**
 * Connect (or reuse) the realtime socket. Mirrors the web client:
 * the JWT is sent in the handshake so the server registers the user and
 * joins them to their `user:<id>` room (for targeted events like new bids).
 */
export const connectSocket = (userId: string): Socket => {
  const token = getAccessToken();

  if (socket && lastUserId && lastUserId !== userId) {
    socket.disconnect();
    socket = null;
  }
  if (socket?.connected) return socket;
  if (socket && !socket.disconnected) return socket;
  if (socket) { socket.disconnect(); socket = null; }

  lastUserId = userId;

  socket = io(SOCKET_URL, {
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    auth: token ? { token } : undefined,
  });

  socket.on('connect', () => {
    // Re-register on every (re)connect to guarantee room membership.
    socket?.emit('register', { userId, role: 'customer' });
    console.log('[socket] connected', socket?.id, '→ registered', userId);
  });
  socket.on('connect_error', (err) => {
    console.log('[socket] connect_error:', err?.message);
  });
  socket.on('disconnect', (reason) => {
    console.log('[socket] disconnected:', reason);
  });

  socket.io.on('reconnect_attempt', () => {
    const fresh = getAccessToken();
    if (socket) socket.auth = fresh ? { token: fresh } : {};
  });

  return socket;
};

export const getSocket = (): Socket | null => socket;

export const disconnectSocket = (): void => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    lastUserId = null;
  }
};
