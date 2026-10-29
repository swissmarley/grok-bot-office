import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import type { FastifyInstance } from 'fastify';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/** Serves the built web UI from `dir`; unknown paths get index.html (single-page app). */
export function serveStatic(app: FastifyInstance, dir: string): void {
  const root = resolve(dir);
  const index = join(root, 'index.html');
  if (!existsSync(index)) throw new Error(`No built UI in ${root}. Run \`pnpm --filter @grok-office/web build\`.`);

  app.get('/*', async (req, reply) => {
    let path: string;
    try {
      path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    } catch {
      return reply.code(400).send();
    }
    if (path.startsWith('/api/') || path === '/ws') return reply.code(404).send();
    const file = resolve(root, '.' + path);
    // Only files inside the build folder.
    const inside = file === root || file.startsWith(root + sep);
    const target = inside && existsSync(file) && statSync(file).isFile() ? file : index;
    const hashed = target !== index && target.includes(`${sep}assets${sep}`);
    return reply
      .type(TYPES[extname(target)] ?? 'application/octet-stream')
      .header('cache-control', hashed ? 'public, max-age=31536000, immutable' : 'no-cache')
      .send(createReadStream(target));
  });
}
