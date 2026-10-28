import { Header } from './panels/Header';
import { Team } from './panels/Team';
import { Office } from './scene/Office';
import { useOffice } from './store';

export function App() {
  const link = useOffice((s) => s.link);

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
    <div className="flex h-full flex-col">
      <Header />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <section className="relative min-h-[45vh] flex-1">
          <Office />
        </section>
        <aside className="flex w-full flex-col border-line bg-panel max-md:border-t md:w-[360px] md:border-l">
          <Team />
        </aside>
      </div>
    </div>
  );
}
