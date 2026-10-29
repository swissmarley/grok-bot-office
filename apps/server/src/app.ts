import Fastify, { type FastifyInstance, type FastifyReply } from 'fastify';
import type { Auth } from './auth.js';
import type { OfficeState } from './office-state.js';
import { ROLE_MAX_CHARS } from './roles.js';
import type { BotSource } from './sources/source.js';
import { serveStatic } from './static.js';
import { attachWebSocket } from './ws.js';

type BotParams = { Params: { id: string } };

/** HTTP + WS server. No CORS: cross-origin requests get no Access-Control headers and fail. */
export function buildApp(state: OfficeState, auth: Auth, source?: BotSource, opts: { staticDir?: string } = {}): FastifyInstance {
  const app = Fastify({ logger: false, bodyLimit: 16 * 1024 });

  // The UI can approve real actions: no framing (clickjacking), no sniffing, no referrers,
  // and the page may only talk to this server.
  const wsHosts = [...auth.hosts].map((h) => `ws://${h}`).join(' ');
  app.addHook('onSend', async (_req, reply) => {
    reply.header('x-frame-options', 'DENY');
    reply.header('x-content-type-options', 'nosniff');
    reply.header('referrer-policy', 'no-referrer');
    reply.header('cross-origin-opener-policy', 'same-origin');
    reply.header('cross-origin-resource-policy', 'same-origin');
    reply.header(
      'content-security-policy',
      `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; ` +
        `connect-src 'self' ${wsHosts}; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    );
  });

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

  // Everything else under /api needs the session cookie.
  app.addHook('preHandler', async (req, reply) => {
    if (req.url.startsWith('/api/') && !req.url.startsWith('/api/session') && !auth.hasSession(req.headers)) {
      return reply.code(401).send();
    }
  });

  /** Runs a source action for a known bot; failures come back as { error } with 502. */
  const botAction = (run: (id: string) => Promise<void>) => async (req: { params: { id: string } }, reply: FastifyReply) => {
    const { id } = req.params;
    if (!state.has(id)) return reply.code(404).send({ error: 'No such bot.' });
    try {
      await run(id);
      return reply.code(204).send();
    } catch (err) {
      return reply.code(502).send({ error: err instanceof Error ? err.message : String(err) });
    }
  };

  if (source) {
    app.post<BotParams>('/api/bots/:id/stop', botAction((id) => source.stopBot(id)));
    app.post<BotParams>('/api/bots/:id/open', botAction((id) => source.openBot(id)));
    app.post('/api/reconnect', async (_req, reply) => {
      await source.reconnect();
      return reply.code(204).send();
    });
  }

  app.post<BotParams & { Body: { role?: unknown } }>('/api/bots/:id/role', async (req, reply) => {
    const { role } = req.body ?? {};
    if (typeof role !== 'string' || role.length > ROLE_MAX_CHARS * 4) return reply.code(400).send({ error: 'role must be a string' });
    if (!state.has(req.params.id)) return reply.code(404).send({ error: 'No such bot.' });
    state.setRole(req.params.id, role);
    return reply.code(204).send();
  });

  if (opts.staticDir) serveStatic(app, opts.staticDir);

  const wss = attachWebSocket(app.server, state, auth);
  app.addHook('onClose', async () => {
    for (const client of wss.clients) client.terminate();
    wss.close();
  });
  return app;
}
