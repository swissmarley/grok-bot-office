# Grok Bot Office — passaggio di consegne alla sessione locale

Questo documento è per una sessione Claude Code che gira **sul Mac di Nakya**, dentro questo
repo, con l'app Grok Bot installata. Contiene lo stato del lavoro, le regole da rispettare e
le azioni da fare, nell'ordine. La specifica resta `SPEC.md`; questo file dice cosa manca.

- Repo: `swissmarley/grok-bot-office`, branch **`feature/grok-bot-office`** (tutto il lavoro è qui).
- A fine lavoro il branch va portato in `main` (vedi passo 8).
- Lingua con l'utente: italiano. Fermati alla fine di ogni milestone, mostra il risultato e
  spunta i criteri di `SPEC.md`.

## 1. Stato attuale

| Milestone | Stato |
| --- | --- |
| M0 Mock | ✅ `pnpm dev --mock`, tutti gli stati in 2 minuti (test automatico) |
| M1 Scena | ✅ selezione + camera, ora del giorno, reduced motion, 14 avatar di Grok Bot in 3D |
| M2 Pannelli | ✅ Team, Dettaglio, Activity, toast, bottom sheet mobile, test di coerenza col server |
| M3 Bridge live | ✅ verificata sul Mac il 29.10.2026 (log in 0,8–1,4 s, riconnessione da sola) |
| M4 Attività fini | ✅ verificata sul Mac: `office-watch` legge `currentActivity` del roster; i bot con riga di stato (`SetStatus`) si classificano dalle parole (`toolFromStatusText`) |
| M5 Approvazioni | ✅ V1 verificata (domande con opzioni senza risposta = needs_you, patch 0003); ✅ V2 con ok dell'utente (proposta A, patch 0004): Allow once/Deny per le card di Auto Review, Discard per le bozze email (verificato dal vivo), nessun pulsante per il resto. Da rifare dal vivo quando compare una vera card `auto-review-approval`. |
| M6 Rifinitura | ✅ 100 fps con 12 bot sul Mac (`GBO_MOCK_BOTS=12`, `&stats`), README aggiornato |

**Ricerca V2 (Grok Bot 0.78.1, dal codice dell'app):** la card è una voce `send-message` con
`message.type === 'auto-review-approval'` e `message.approval` (`requestId`, `status`:
pending/approved/always/denied/expired, `summary`, `summaryCopy`, `command`, `surface`,
`appliedRules`, `cautionNote`, `createdAtMs`). Si risolve con
`transcript.resolveAutoReviewApproval({ entryId, requestId, resolution, agentId, approvalPlatform: 'desktop', sessionId? })`:
Allow once = `'approved'`, Deny = `'denied'` (mai `'always'`); risponde `'stale'` se scaduta.
`virtual-card-approval`, `publish-approval`, `cookie-origin-approval`, `meeting-join-consent` usano
altri metodi: per l'ufficio sono "Serve te nell'app". Una card `auto-review-approval` vera non è
ancora stata vista: le domande con opzioni (`widget`) sono un'altra cosa.

Fork del bridge: **pronto come patch** in `bridge-fork/patches/` (non è stato possibile creare
il fork su GitHub dalla sessione cloud). Aggiunge `src/adapter/grokbot-internals.ts` con
avatar, bot principale, fase del computer, `grokbot open <bot>` e `grokbot internals`.
Testato con `bun test` (7 test) e contro una finta app in Chromium. L'ufficio lo usa già
(`apps/server/src/sources/bridge.ts`) e degrada se trova il bridge originale.

## 2. Regole da non rompere

Vengono da `SPEC.md` e dall'`AGENTS.md` del bridge; alcune le ha chieste l'utente.

- Server solo su `127.0.0.1:4317`, token per avvio → cookie httpOnly, controllo Origin e
  Host, niente CORS, `X-Frame-Options: DENY` e CSP (in `apps/server/src/app.ts`).
- **L'ufficio non avvia, chiude o riavvia mai Grok Bot.** Il bridge rilancia l'app se non
  trova la porta debug: per questo ogni comando gira con `GROKBOT_APP` puntato a un
  percorso inesistente e la connessione si controlla con `grokbot status`. Non togliere
  questa protezione. La porta la apre l'utente con `grokbot launch` e la chiude con `grokbot restore`.
- **Mai approvazioni automatiche, in batch o da scorciatoia**: un click per card, solo
  **Allow once** e **Deny**. Dettagli (azione, target, scope, input) sempre visibili prima
  dei pulsanti; se non sono leggibili, niente pulsanti e solo "Apri in Grok Bot".
- Password, 2FA, CAPTCHA, pagamenti, `secret-request`: card "Serve te nell'app", senza pulsanti.
- Il testo dei bot è sempre testo semplice (niente `dangerouslySetInnerHTML`); link solo
  http(s) con `rel="noopener noreferrer"` (`apps/web/src/text.tsx`).
- Non portare mai la finestra di Grok Bot in primo piano da solo: `open` solo su click
  dell'utente (portarla davanti sveglia il computer del bot).
- Nomi di store e campi dell'app **solo** in `src/adapter/grokbot-internals.ts` del fork.
- Prove live: agiscono sull'account vero. Messaggi di test brevi, etichettati come test,
  solo ricerca. Avvisa l'utente prima di `grokbot launch` (riavvia l'app).
- Non committare codice estratto dall'app (`app.asar`) né dati privati: nomi dei bot,
  conversazioni e file dei probe restano fuori dal repo (i probe vanno in una cartella temporanea).
- Commit solo con typecheck e test verdi: `pnpm typecheck && pnpm test`.

## 3. Setup sul Mac e verifica M3

```sh
cd grok-bot-office && git checkout feature/grok-bot-office && git pull && pnpm install
```

Crea il fork del bridge e applica la patch:

```sh
cd ..
gh repo fork TheSethRose/grokbot-bridge --clone=true --remote=true   # crea swissmarley/grokbot-bridge
cd grokbot-bridge
git checkout -b office-adapter
git am ../grok-bot-office/bridge-fork/patches/*.patch
bun install && bun test && bun run check && bun run build
git diff --exit-code dist/cli.js        # la build deve coincidere con quella committata
git push -u origin office-adapter
npm install -g https://github.com/swissmarley/grokbot-bridge/archive/refs/heads/office-adapter.tar.gz
grokbot --version && grokbot internals  # dopo `grokbot launch`: tutte le righe "ok"
```

Se `gh` non c'è: `brew install gh && gh auth login`. Se `internals` segna `FAIL` su una
voce, l'app è cambiata rispetto alla 0.78.1: aggiorna `NAMES` e la finta app nel test, insieme.

Poi, con l'app aperta (`grokbot launch`, dopo aver avvisato l'utente):

```sh
cd ../grok-bot-office && pnpm start
```

Criteri M3 da verificare con l'utente e spuntare in `SPEC.md`:
1. Un messaggio mandato a un bot dall'app compare nel suo log nell'ufficio entro 2 s.
2. Chiudendo Grok Bot il badge passa a Disconnected; dopo `grokbot launch` torna Connected da solo.

Controlla anche che ogni bot mostri la stessa forma e lo stesso colore che ha in Grok Bot, che
il bot principale abbia la stellina e che "Apri in Grok Bot" apra la conversazione giusta.

## 4. M4 — Step dei tool (coding / browsing / terminal)

**Cosa sappiamo (probe su Grok Bot 0.78.1):** nelle conversazioni (`transcript`) ci sono solo
voci `message`, `send-message/*` (text, widget, email-draft, secret-request) ed `event`
(automation-changed). **Nessuna voce `tool-call`**, nemmeno durante 90 s di lavoro di un bot.
Le righe del roster hanno `isRunning`, `isRunningTurn`, `isComposingMessage`,
`runningSessionIds`, `lastEntry` (`{kind:'text', text}`), `harness`. Store candidati per gli
step: `agentTasks.snapshotsFor(agentId)`, `subagents.snapshotsFor`, `asyncTasks.snapshotsFor`,
`renderStream` (`recordActiveAgent`), `turnOutcome`, `workingAgents` (è un array), la "computer
view" (`desktop.setComputerViewOpen`), `screen`.

**Da fare:**
1. Fai lavorare un bot su un compito che usa browser e terminale (messaggio di test breve).
2. Mentre lavora: `node scripts/probe-grokbot.mjs --watch 90 > /tmp/probe.json`. Se non basta,
   estendi lo `SAMPLE` del probe per leggere `snapshotsFor(agentId)` degli store qui sopra
   (solo getter di snapshot) e/o cerca nel codice estratto da `app.asar` (in una cartella
   temporanea) dove l'app disegna "Using browser", "Running command" o simili.
3. Nel fork, in `grokbot-internals.ts`: una funzione page-side che dà per bot il tool in uso
   (`browser | shell | editor | file | git | null`), e un comando in streaming, per esempio
   `grokbot office-watch --json` con una riga `{"type":"tool","bot":<name>,"tool":...,"at":...}`
   a ogni cambio (stesso schema heartbeat di `watch` in `src/bot.ts`). Aggiorna `internals`,
   i test con la finta app, il README del fork; ricompila `dist/cli.js`.
4. Nell'ufficio (`apps/server/src/sources/bridge.ts`): avvia anche `office-watch` se c'è e
   passa `signals.tool`. Se manca o fallisce, gli stati restano `thinking` **senza errori in UI**
   (criterio M4). Il mapping tool → stato è già in `apps/server/src/status.ts`. Test col finto
   grokbot in `apps/server/test/fixtures/fake-grokbot.mjs`.
5. Criteri: un bot che apre il browser passa a browsing; se il fork fallisce, thinking senza errori.

## 5. M5 — Approvazioni

**V1 (già fatta, da verificare):** su `needs_input` il bot passa a needs_you; nel Dettaglio c'è
la card "è in attesa di te in Grok Bot" e "Apri in Grok Bot" (ora con `grokbot open`).
Criterio: needs_you entro 2 s e Apri in Grok Bot porta sulla conversazione giusta.

**Cosa sappiamo per la V2:** lo store `transcript` ha metodi di un solo argomento (oggetto):
`resolveAutoReviewApproval`, `resolveLocalToolPermission`, `resolveConnectorGrant`,
`resolveVirtualCardApproval`, `beginSpendApproval`, `respondToWidget`, `dismissWidget`,
`submitUserForm`. Le domande con opzioni sono voci `send-message/widget` con `requestId`,
`respondedValue` o `widgetSkipped`. Una card di approvazione in attesa **non è ancora stata
vista**: serve la sua forma (`awaitingUserResponse` sulla riga e la voce nel transcript).

**Da fare, in quest'ordine:**
1. Con l'utente, fai comparire una card di approvazione (per esempio chiedi a un bot di
   preparare un'azione che richiede conferma) e **non rispondere**. Lancia il probe con
   `--watch` e leggi `awaitingUserResponse` e la voce del transcript. Dal codice di `app.asar`
   ricava quale metodo `resolve…` risponde a quel tipo di card e con quale oggetto
   (Allow once / Deny; mai "Always allow").
2. **Mostra all'utente cosa hai trovato (store, campi, metodo, argomento) e aspetta il suo ok
   esplicito prima di scrivere codice che risponde alle card.** È una condizione posta
   dall'utente all'inizio del progetto.
3. Fork: in `grokbot-internals.ts` `pendingApproval(botId)` → `{ id, action, target, scope,
   inputs, origin, createdAt, expiresAt? }` (o `null`, o `{ takeover: true }` per password,
   2FA, CAPTCHA, pagamenti, secret-request) e `resolveApproval(id, 'allow_once' | 'deny')`
   tramite il metodo interno, **mai click simulati sul DOM**. CLI: `grokbot pending <bot> --json`,
   `grokbot resolve <id> allow_once|deny --json`. Test con la finta app che falliscono chiari
   se i nomi cambiano.
4. Ufficio:
   - `BotSource`: `resolveApproval(id, decision)` (mock incluso; nel mock le card "chat"
     aspettano la decisione invece di approvarsi da sole).
   - `BridgeSource`: su `needs_input` chiama `pending`, emette `approval.requested`; `expiresAt`
     = +10 min se origin ≠ chat (lo calcola già `OfficeState`).
   - Server: `POST /api/approvals/:id` `{ decision: 'allow_once' | 'deny' }` (sessione + Origin
     come le altre azioni); ogni decisione in `~/.grok-office/audit.log`
     (`ISO-time \t bot \t action \t allowed|denied|expired`), anche le scadute.
   - Web (`apps/web/src/panels/Detail.tsx`, `ApprovalCard`): pulsanti Allow once e Deny sotto
     i dettagli, solo se action/target sono leggibili; disabilitati durante la richiesta;
     countdown; a zero "Expired" e niente pulsanti; toast con l'esito (es. "Approved. Relay is
     posting the thread"); card "Serve te nell'app" per i takeover. Nessuna scorciatoia da tastiera.
   - Test: server (endpoint, audit.log, niente decisione senza sessione/Origin), web (pulsanti
     assenti se i dettagli mancano o la card è scaduta).
5. Criteri: Allow once e Deny funzionano, l'esito è nel toast e in `audit.log`; le card scadute
   diventano Expired senza pulsanti.

## 6. M6 — 60 fps e README

```sh
GBO_MOCK_BOTS=12 pnpm start --mock
```
Apri il link aggiungendo `&stats`: il contatore FPS sta in basso a sinistra. Con bot in
movimento deve restare intorno a 60 su un M1. Se non ci arriva, nell'ordine:
- `shadow-mapSize` da 2048 a 1024 (`apps/web/src/scene/Office.tsx`);
- `dpr={[1, 1.5]}`;
- meno punti nei contorni degli avatar (`apps/web/src/avatar/shapes.ts`);
- monitor a 8 fps invece di 12 (`apps/web/src/scene/Desks.tsx`).

Poi rileggi il README: setup, rischi della porta debug, `grokbot restore`, installazione del fork.

## 7. Dettagli utili

- Comandi: `pnpm dev [--mock]` (Vite + server), `pnpm start [--mock]` (build + server + browser),
  `pnpm test`, `pnpm typecheck`. Mock: `GBO_MOCK_BOTS=N`, `GBO_MOCK_SHOWCASE=1` (un bot per stato).
- Server: `apps/server/src/` (`office-state.ts` normalizza, `status.ts` mapping segnali → stato,
  `sources/bridge.ts` e `sources/mock.ts`, `app.ts` HTTP, `ws.ts` WebSocket).
- Web: `apps/web/src/` (`scene/` 3D, `panels/` UI, `avatar/` forme, `store.ts`, `alerts.ts`).
- Tipi condivisi: `packages/shared/src/types.ts` (Bot ha in più `avatar?` e `main?`, approvati
  dall'utente); `avatarFromApp()` converte `avatarShape`/`avatarColor` dell'app.
- Forme dell'app viste: blob, heart, star, wedge, clover, hex, pumpkin, teardrop. Le altre 6 del
  picker (cloud, square, sparkle, flower, pill, pentagon) hanno nomi nostri finché un bot non le
  usa: se ne compare una nuova, aggiungi l'alias in `SHAPE_ALIASES`.
- Il primo probe ha mostrato anche `avatarPhoto`/`avatarDataUrl` (foto personalizzate, vuote
  per ora) e il disegno SVG esatto dell'avatar in `#sand-agent-mark-source-<id>`: si possono
  usare in futuro per avatar identici al pixel.
- `@handle` dell'account: non trovato. Ultimo candidato: `savedAccounts` (`accounts[]`). Finché
  manca, il badge mostra la versione di Grok Bot.

## 8. Chiusura

Quando M3–M6 sono verdi e l'utente ha spuntato i criteri:
1. `pnpm typecheck && pnpm test`, poi aggiorna le caselle in `SPEC.md`.
2. Porta `feature/grok-bot-office` in `main` (accordo con l'utente: un branch per tutte le
   milestone, poi `main`). Con una PR (`gh pr create --base main`) o un merge, come preferisce
   l'utente; poi push.
3. Ricorda all'utente `grokbot restore` per chiudere la porta debug.
