import type { Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type WebSocket } from 'ws';
import type { OfficeEvent } from '@grok-office/shared';
import type { Auth } from './auth.js';
import type { OfficeState } from './office-state.js';

/** WebSocket at /ws: a snapshot when a client opens, then deltas. Browser → server goes over REST. */
export function attachWebSocket(server: Server, state: OfficeState, auth: Auth): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });

  server.on('upgrade', (req, socket, head) => {
    const path = new URL(req.url ?? '/', 'http://x').pathname;
    if (path !== '/ws') return reject(socket, 404);
    if (!auth.hostAllowed(req.headers) || !auth.originAllowed(req.headers)) return reject(socket, 403);
    if (!auth.hasSession(req.headers)) return reject(socket, 401);
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  wss.on('connection', (ws: WebSocket) => {
    const send = (event: OfficeEvent) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(event));
    };
    send(state.snapshot());
    send(state.connection());
    const unsubscribe = state.subscribe(send);

    let alive = true;
    ws.on('pong', () => (alive = true));
    const ping = setInterval(() => {
      if (!alive) return ws.terminate();
      alive = false;
      ws.ping();
    }, 15_000);

    // The protocol is one-way; anything the browser sends here is ignored.
    ws.on('message', () => {});
    ws.on('close', () => {
      clearInterval(ping);
      unsubscribe();
    });
  });

  return wss;
}

function reject(socket: Duplex, status: 401 | 403 | 404): void {
  const text = { 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found' }[status];
  socket.end(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
}
