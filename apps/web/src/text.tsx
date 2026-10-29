import { Fragment, type ReactNode } from 'react';

// Bot text can carry anything from the web: it is only ever rendered as React text.
// http(s) URLs become plain links that open in a new tab without a referrer.

const URL_RE = /https?:\/\/[^\s<>()[\]"']+/g;

export function BotText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const url = m[0].replace(/[.,;:!?]+$/, '');
    const start = m.index!;
    if (start > last) parts.push(text.slice(last, start));
    parts.push(
      <a key={start} href={url} target="_blank" rel="noopener noreferrer" className="text-st-coding underline underline-offset-2 break-all">
        {url}
      </a>,
    );
    last = start + url.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts.map((p, i) => <Fragment key={i}>{p}</Fragment>)}</>;
}
