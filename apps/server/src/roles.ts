import { readJsonObject, writeJson } from './json-file.js';

export const ROLE_MAX_CHARS = 40;

/** Roles you edited in the office, persisted as { [botId]: role } (in memory only without a file). */
export class RoleStore {
  private roles: Record<string, string> = {};

  constructor(private readonly file?: string) {
    for (const [id, role] of Object.entries(file ? readJsonObject(file) : {})) {
      if (typeof role === 'string') this.roles[id] = role;
    }
  }

  get(botId: string): string | undefined {
    return this.roles[botId];
  }

  /** Empty clears the override, so the default role comes back. */
  set(botId: string, role: string): void {
    const clean = role.trim().slice(0, ROLE_MAX_CHARS);
    if (clean) this.roles[botId] = clean;
    else delete this.roles[botId];
    if (this.file) writeJson(this.file, this.roles);
  }
}
