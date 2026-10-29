import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';

export const COOKIE_NAME = 'gbo_session';

/**
 * Local-only access control: a random token per start (handed out in the URL,
 * then kept in an httpOnly cookie), an Origin allowlist and a Host allowlist
 * (against DNS rebinding).
 */
export class Auth {
  readonly token: string;
  readonly origins: ReadonlySet<string>;
  readonly hosts: ReadonlySet<string>;

  constructor(opts: { token?: string; port: number; webOrigin: string }) {
    this.token = opts.token || randomBytes(24).toString('base64url');
    const origins = new Set<string>();
    for (const origin of [opts.webOrigin, `http://127.0.0.1:${opts.port}`]) {
      const url = new URL(origin);
      origins.add(url.origin);
      if (url.hostname === '127.0.0.1') origins.add(`${url.protocol}//localhost:${url.port}`);
      if (url.hostname === 'localhost') origins.add(`${url.protocol}//127.0.0.1:${url.port}`);
    }
    this.origins = origins;
    this.hosts = new Set([...origins].map((o) => new URL(o).host));
  }

  tokenMatches(candidate: unknown): boolean {
    if (typeof candidate !== 'string') return false;
    const a = Buffer.from(candidate);
    const b = Buffer.from(this.token);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  hostAllowed(headers: IncomingHttpHeaders): boolean {
    return typeof headers.host === 'string' && this.hosts.has(headers.host);
  }

  originAllowed(headers: IncomingHttpHeaders): boolean {
    return typeof headers.origin === 'string' && this.origins.has(headers.origin);
  }

  hasSession(headers: IncomingHttpHeaders): boolean {
    return this.tokenMatches(readCookie(headers.cookie, COOKIE_NAME));
  }

  sessionCookie(): string {
    return `${COOKIE_NAME}=${this.token}; HttpOnly; SameSite=Strict; Path=/`;
  }
}

function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq !== -1 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return undefined;
}
