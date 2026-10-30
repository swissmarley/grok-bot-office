import { describe, expect, it } from 'vitest';
import { avatarFromApp } from '@grok-office/shared';

// Values from the probe of Grok Bot 0.78.1 (avatarShape / avatarColor on Bot-list rows).
describe('avatarFromApp', () => {
  it.each([
    ['blob', 'black', 'blob', '#FFFFFF'],
    ['heart', 'red', 'heart', '#FF263C'],
    ['star', 'violet', 'star', '#9159FE'],
    ['wedge', 'green', 'wedge', '#00C972'],
    ['clover', 'yellow', 'clover', '#FF9800'],
    ['hex', 'cyan', 'hex', '#00BCA6'],
    ['pumpkin', 'orange', 'pumpkin', '#FF6700'],
    ['teardrop', 'blue', 'teardrop', '#1084FE'],
  ])('%s + %s', (shape, color, ours, hex) => {
    expect(avatarFromApp(shape, color)).toEqual({ avatar: { shape: ours }, color: hex });
  });

  it.each([
    ['pebble', 'blob'],
    ['squircle', 'square'],
    ['tablet', 'pill'],
    ['cloud', 'cloud'],
  ])("maps the app's default shape %s to %s", (shape, ours) => {
    expect(avatarFromApp(shape, 'magenta')).toEqual({ avatar: { shape: ours }, color: '#FF309B' });
  });

  it('falls back to the blob and the office palette for names it does not know', () => {
    expect(avatarFromApp('dodecahedron', 'ultraviolet')).toEqual({ avatar: { shape: 'blob' } });
    expect(avatarFromApp(null, undefined)).toEqual({ avatar: { shape: 'blob' } });
  });
});
