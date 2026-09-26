import type { IpcMain, WebContents } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IPC_CHANNELS } from '../../src/shared/ipc-channels';
import type { ProjectSessionManager } from '../../src/main/projects/session';

const mocks = vi.hoisted(() => ({
  resolveRuntime: vi.fn(),
  start: vi.fn(async () => undefined),
  append: vi.fn(),
  stop: vi.fn(),
  cancel: vi.fn(),
}));

vi.mock('../../src/main/services/codex-runtime', () => ({
  resolveCodexRuntime: mocks.resolveRuntime,
}));
vi.mock('../../src/main/transcription/realtime-session', () => ({
  RealtimeTranscriptionSession: class {
    id: string;
    start = mocks.start;
    append = mocks.append;
    stop = mocks.stop;
    cancel = mocks.cancel;
    constructor(id: string) {
      this.id = id;
    }
  },
}));

import { registerTranscriptionIpcHandlers } from '../../src/main/ipc/handlers/transcription';

type Handler = (event: { sender: WebContents }, payload?: unknown) => Promise<unknown> | unknown;

function setup() {
  const handlers = new Map<string, Handler>();
  const ipcMain = { handle: (channel: string, handler: Handler) => handlers.set(channel, handler) };
  const sender = {
    id: 1,
    isDestroyed: () => false,
    once: vi.fn(),
    removeListener: vi.fn(),
    send: vi.fn(),
  } as unknown as WebContents;
  const currentSettings = {
    enabled: true,
    allowApiCalls: true,
    transcriptionEnabled: true,
    transcriptionAllowRemoteAudio: true,
  };
  const sessionManager = {
    getRepository: () => ({ getOrCreateCodexSettings: () => currentSettings }),
    getCurrentProjectId: () => 'project-1',
  } as unknown as ProjectSessionManager;
  registerTranscriptionIpcHandlers(ipcMain as unknown as IpcMain, sessionManager);
  const call = (channel: string, payload?: unknown) => {
    const handler = handlers.get(channel);
    if (!handler) throw new Error(`Missing handler: ${channel}`);
    return handler({ sender }, payload);
  };
  return { call, sender, currentSettings };
}

describe('transcription IPC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRuntime.mockResolvedValue({
      settings: {
        enabled: true,
        allowApiCalls: true,
        transcriptionEnabled: true,
        transcriptionAllowRemoteAudio: true,
        transcriptionModel: 'gpt-live-transcribe',
        transcriptionLanguage: 'auto',
      },
      runtimeApiKey: 'fake-test-key',
    });
  });

  it('blocks the connection without dedicated audio consent', async () => {
    mocks.resolveRuntime.mockResolvedValueOnce({
      settings: {
        enabled: true,
        allowApiCalls: true,
        transcriptionEnabled: true,
        transcriptionAllowRemoteAudio: false,
      },
      runtimeApiKey: 'fake-test-key',
    });
    const { call } = setup();
    await expect(call(IPC_CHANNELS.transcriptionStart)).rejects.toThrow(
      'transcription_consent_required',
    );
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it('validates audio before forwarding it and keeps the API key out of IPC responses', async () => {
    const { call, sender } = setup();
    const started = (await call(IPC_CHANNELS.transcriptionStart)) as { sessionId: string };
    expect(started.sessionId).toMatch(/^[a-f0-9-]{36}$/);
    expect(JSON.stringify(started)).not.toContain('fake-test-key');
    expect(mocks.start).toHaveBeenCalledWith('fake-test-key');

    expect(() =>
      call(IPC_CHANNELS.transcriptionAppend, {
        sessionId: started.sessionId,
        audio: '!invalid!',
      }),
    ).toThrow('transcription_invalid_audio');
    expect(mocks.append).not.toHaveBeenCalled();

    await call(IPC_CHANNELS.transcriptionAppend, {
      sessionId: started.sessionId,
      audio: Buffer.alloc(4_800).toString('base64'),
    });
    expect(mocks.append).toHaveBeenCalledWith(Buffer.alloc(4_800));
    await call(IPC_CHANNELS.transcriptionStop, started);
    expect(mocks.stop).toHaveBeenCalledOnce();
    await call(IPC_CHANNELS.transcriptionCancel, started);
    expect(mocks.cancel).toHaveBeenCalledOnce();
    expect(sender.send).not.toHaveBeenCalled();
  });

  it('stops forwarding audio when consent is revoked during a turn', async () => {
    const { call, currentSettings } = setup();
    const started = (await call(IPC_CHANNELS.transcriptionStart)) as { sessionId: string };
    currentSettings.transcriptionAllowRemoteAudio = false;
    expect(() =>
      call(IPC_CHANNELS.transcriptionAppend, {
        sessionId: started.sessionId,
        audio: Buffer.alloc(4_800).toString('base64'),
      }),
    ).toThrow('transcription_consent_required');
    expect(mocks.append).not.toHaveBeenCalled();
    expect(mocks.cancel).toHaveBeenCalledOnce();
  });
});
