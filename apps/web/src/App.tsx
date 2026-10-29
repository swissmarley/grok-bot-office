import { useNeedsYouAlerts } from './alerts';
import { Footer } from './panels/Footer';
import { Header } from './panels/Header';
import { Sidebar } from './panels/Sidebar';
import { Toaster } from './panels/Toaster';
import { Office } from './scene/Office';
import { useOffice } from './store';

export function App() {
  const link = useOffice((s) => s.link);
  useNeedsYouAlerts();
  const offline = useOffice((s) => s.link !== 'open' || s.account.state !== 'connected');
  const hasBots = useOffice((s) => Object.keys(s.bots).length > 0);

  if (link === 'unauthorized') {
    return (
      <main className="grid h-full place-items-center p-6 text-center">
        <div className="max-w-sm space-y-2">
          <h1 className="text-lg font-semibold">Grok Bot Office is locked</h1>
          <p className="text-sm text-muted">
            Open the link with <code className="font-mono">?token=…</code> printed by the office server in your terminal.
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="flex h-dvh flex-col">
      <Header />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <section className="relative min-h-0 flex-1">
          <Office />
          {offline && hasBots && (
            <p role="status" className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-panel/90 px-3 py-1 text-xs text-muted ring-1 ring-line">
              {link === 'open' ? 'Grok Bot is disconnected' : 'Office server offline'}: showing the last known state
            </p>
          )}
        </section>
        <Sidebar />
      </div>
      <Footer />
      <Toaster />
    </div>
  );
}
