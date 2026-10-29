// Per-browser preferences; storage can be unavailable (private mode), so failures are ignored.

const MUTE_KEY = 'gbo.muted';
export function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // Private mode: the choice lasts for this tab only.
  }
}

