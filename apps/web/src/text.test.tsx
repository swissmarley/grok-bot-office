import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BotText } from './text';

const html = (text: string) => renderToStaticMarkup(<p><BotText text={text} /></p>);

describe('BotText', () => {
  it('never renders bot text as HTML', () => {
    const out = html('<img src=x onerror="alert(1)"> <script>alert(2)</script>');
    expect(out).not.toContain('<img');
    expect(out).not.toContain('<script');
    expect(out).toContain('&lt;img');
  });

  it('links only http(s) URLs, without opener or referrer', () => {
    const out = html('See https://example.com/a?b=1. Not javascript:alert(1) or data:text/html,x');
    expect(out).toContain('<a href="https://example.com/a?b=1" target="_blank" rel="noopener noreferrer"');
    expect(out).not.toContain('href="javascript');
    expect(out).not.toContain('href="data');
    expect(out).toContain('</a>. Not javascript:alert(1)');
  });
});
