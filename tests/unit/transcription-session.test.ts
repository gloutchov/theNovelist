import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TranscriptionEvent } from '../../src/main/transcription/realtime-session';

const mocks = vi.hoisted(() => ({
  validateLocal: vi.fn(async () => undefined),
  remoteStart: vi.fn(async () => undefined),
  remoteAppend: vi.fn(),
  remoteStop: vi.fn(),
  remoteCancel: vi.fn(),
  localAppend: vi.fn(),
  localStop: vi.fn(),
  localCancel: vi.fn(),
  remoteEvent: null as ((event: TranscriptionEvent) => void) | null,
  localEvent: null as ((event: TranscriptionEvent) => void) | null,
}));

vi.mock('../../src/main/transcription/local-whisper-session', () => ({
  validateLocalWhisper: mocks.validateLocal,
  LocalWhisperSession: class {
    append = mocks.localAppend;
    stop = mocks.localStop;
    cancel = mocks.localCancel;
    constructor(_id: string, _options: unknown, onEvent: (event: TranscriptionEvent) => void) {
      mocks.localEvent = onEvent;
    }
  },
}));
vi.mock('../../src/main/transcription/realtime-session', () => ({
  RealtimeTranscriptionSession: class {
    start = mocks.remoteStart;
    append = mocks.remoteAppend;
    stop = mocks.remoteStop;
    cancel = mocks.remoteCancel;
    constructor(
      _id: string,
      _model: string,
      _language: string,
      onEvent: (event: TranscriptionEvent) => void,
    ) {
      mocks.remoteEvent = onEvent;
    }
  },
}));

import { TranscriptionSession } from '../../src/main/transcription/session';

function create(
  provider: 'openai_api' | 'whisper_local',
  fallbackProvider: 'none' | 'whisper_local',
) {
  const events: TranscriptionEvent[] = [];
  const session = new TranscriptionSession(
    'turn-1',
    {
      provider,
      fallbackProvider,
      model: 'gpt-live-transcribe',
      language: 'it',
      local: { executablePath: '/tmp/whisper-cli', modelPath: '/tmp/model.bin', language: 'it' },
    },
    (event) => events.push(event),
  );
  return { session, events };
}

describe('transcription provider selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.remoteEvent = null;
    mocks.localEvent = null;
  });

  it('uses only local Whisper without resolving or starting OpenAI', async () => {
    const { session, events } = create('whisper_local', 'none');
    await session.start(null);
    session.append(Buffer.alloc(4_800));
    session.stop();
    mocks.localEvent?.({ sessionId: 'turn-1', type: 'final', text: 'Testo locale' });
    expect(mocks.remoteStart).not.toHaveBeenCalled();
    expect(mocks.localAppend).toHaveBeenCalledOnce();
    expect(events.filter((event) => event.type === 'final')).toHaveLength(1);
    expect(session.activeProvider).toBe('whisper_local');
  });

  it('replays one bounded turn locally after a remote service failure', async () => {
    const { session, events } = create('openai_api', 'whisper_local');
    await session.start('test-key');
    session.append(Buffer.alloc(4_800));
    mocks.remoteEvent?.({ sessionId: 'turn-1', type: 'partial', text: 'Partial' });
    mocks.remoteEvent?.({ sessionId: 'turn-1', type: 'error', code: 'service' });
    session.append(Buffer.alloc(4_800));
    session.stop();
    mocks.localEvent?.({ sessionId: 'turn-1', type: 'final', text: 'Finale' });
    mocks.remoteEvent?.({ sessionId: 'turn-1', type: 'final', text: 'Duplicato' });
    expect(mocks.remoteCancel).toHaveBeenCalled();
    expect(mocks.localAppend).toHaveBeenCalledTimes(2);
    expect(events.filter((event) => event.type === 'final')).toEqual([
      { sessionId: 'turn-1', type: 'final', text: 'Finale' },
    ]);
    expect(events).toContainEqual({
      sessionId: 'turn-1',
      type: 'provider',
      provider: 'whisper_local',
      reason: 'fallback',
    });
  });

  it('does not retry invalid audio locally', async () => {
    const { session, events } = create('openai_api', 'whisper_local');
    await session.start('test-key');
    mocks.remoteEvent?.({ sessionId: 'turn-1', type: 'error', code: 'invalid_audio' });
    expect(mocks.localAppend).not.toHaveBeenCalled();
    expect(events.at(-1)).toMatchObject({ type: 'error', code: 'invalid_audio' });
  });

  it('uses local fallback when OpenAI cannot connect before recording', async () => {
    mocks.remoteStart.mockRejectedValueOnce(new Error('transcription_connection_failed'));
    const { session, events } = create('openai_api', 'whisper_local');
    await session.start('test-key');
    expect(session.activeProvider).toBe('whisper_local');
    expect(session.usedFallback).toBe(true);
    expect(events.at(-1)).toMatchObject({ type: 'provider', reason: 'fallback' });
    expect(mocks.localAppend).not.toHaveBeenCalled();
  });

  it('retries locally after a remote timeout following stop', async () => {
    const { session, events } = create('openai_api', 'whisper_local');
    await session.start('test-key');
    session.append(Buffer.alloc(4_800));
    session.stop();
    mocks.remoteEvent?.({ sessionId: 'turn-1', type: 'error', code: 'timeout' });
    expect(mocks.localAppend).toHaveBeenCalledOnce();
    expect(mocks.localStop).toHaveBeenCalledOnce();
    mocks.localEvent?.({ sessionId: 'turn-1', type: 'final', text: 'Locale' });
    expect(events.filter((event) => event.type === 'final')).toHaveLength(1);
  });
});
