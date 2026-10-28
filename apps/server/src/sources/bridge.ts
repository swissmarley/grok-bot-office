import type { BotSource, SourceSink } from './source.js';

/** grokbot-bridge adapter (`grokbot watch/bots/read --json`). Lands in M3. */
export class BridgeSource implements BotSource {
  readonly kind = 'bridge';

  async start(sink: SourceSink): Promise<void> {
    sink.connection('disconnected');
    throw new Error('BridgeSource is not implemented yet (milestone M3). Start with --mock.');
  }

  async stop(): Promise<void> {}
}
