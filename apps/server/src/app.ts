import Fastify, { type FastifyInstance } from 'fastify';
import type { Auth } from './auth.js';
import type { OfficeState } from './office-state.js';
import { attachWebSocket } from './ws.js';

/** HTTP + WS server. No CORS: cross-origin requests get no Access-Control headers and fail. */
export function buildApp(state: OfficeState, auth: Auth): FastifyInstance {
  const app = Fastify({ logger: false, bodyLimit: 16 * 1024 });

  app.addHook('onRequest', async (req, reply) => {
    if (!auth.hostAllowed(req.headers)) return reply.code(403).send();
    const safe = req.method === 'GET' || req.method === 'HEAD';
    if (!safe && !auth.originAllowed(req.headers)) return reply.code(403).send();
  });

  // Swaps the one-time URL token for an httpOnly session cookie.
  app.post<{ Body: { token?: unknown } }>('/api/session', async (req, reply) => {
    if (!auth.tokenMatches(req.body?.token)) return reply.code(401).send();
    return reply.header('set-cookie', auth.sessionCookie()).code(204).send();
  });

  app.get('/api/session', async (req, reply) => reply.code(auth.hasSession(req.headers) ? 204 : 401).send());

  const wss = attachWebSocket(app.server, state, auth);
  app.addHook('onClose', async () => {
    for (const client of wss.clients) client.terminate();
    wss.close();
  });
  return app;
}
