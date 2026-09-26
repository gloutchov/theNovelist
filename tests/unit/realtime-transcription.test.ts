import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import type WebSocket from 'ws';
import {
  RealtimeTranscriptionSession,
  type TranscriptionEvent,
} from '../../src/main/transcription/realtime-session';

class FakeSocket extends EventEmitter {
  readyState = 1;
  bufferedAmount = 0;
  sent: string[] = [];
  closed = false;

  send(value: string): void {
    this.sent.push(value);
  }

  close(): void {
    this.closed = true;
    this.readyState = 3;
    this.emit('close');
  }

  terminate(): void {
    this.close();
  }

  receive(value: Record<string, unknown>): void {
    this.emit('message', Buffer.from(JSON.stringify(value)));
  }
}

async function readySession(model: 'gpt-live-transcribe' | 'gpt-realtime-whisper') {
  const socket = new FakeSocket();
  const events: TranscriptionEvent[] = [];
  const session = new RealtimeTranscriptionSession(
    'test-session',
    model,
    'it',
    (event) => events.push(event),
    () => socket as unknown as WebSocket,
  );
  const started = session.start('test-key');
  socket.emit('open');
  socket.receive({ type: 'session.updated' });
  await started;
  return { socket, events, session };
}

describe('Realtime transcription session', () => {
  it('releases a connection immediately when cancelled before ready', async () => {
    const socket = new FakeSocket();
    socket.readyState = 0;
    const session = new RealtimeTranscriptionSession(
      'early-cancel',
      'gpt-live-transcribe',
      'auto',
      () => undefined,
      () => socket as unknown as WebSocket,
    );
    const started = session.start('test-key');
    session.cancel();
    await expect(started).rejects.toThrow('transcription_cancelled');
    expect(socket.closed).toBe(true);
  });

  it('reports an unavailable model without exposing the server response', async () => {
    const socket = new FakeSocket();
    const events: TranscriptionEvent[] = [];
    const session = new RealtimeTranscriptionSession(
      'missing-model',
      'gpt-realtime-whisper',
      'auto',
      (event) => events.push(event),
      () => socket as unknown as WebSocket,
    );
    const started = session.start('test-key');
    socket.emit('open');
    socket.receive({
      type: 'error',
      error: { code: 'invalid_model', message: 'private server detail' },
    });
    await expect(started).rejects.toThrow('transcription_model_unavailable');
    expect(events).toEqual([]);
    expect(socket.closed).toBe(true);
  });

  it.each(['gpt-live-transcribe', 'gpt-realtime-whisper'] as const)(
    'configures %s and inserts only the final turn',
    async (model) => {
      const { socket, events, session } = await readySession(model);
      const update = JSON.parse(socket.sent[0]!) as {
        session: { audio: { input: { transcription: Record<string, unknown> } } };
      };
      const transcription = update.session.audio.input.transcription;
      expect(transcription.model).toBe(model);
      expect(transcription[model === 'gpt-live-transcribe' ? 'languages' : 'language']).toEqual(
        model === 'gpt-live-transcribe' ? ['it'] : 'it',
      );

      session.append(Buffer.alloc(4_800));
      socket.receive({ type: 'conversation.item.input_audio_transcription.delta', delta: 'Ciao' });
      expect(events).toEqual([{ sessionId: 'test-session', type: 'partial', text: 'Ciao' }]);
      session.stop();
      socket.receive({
        type: 'conversation.item.input_audio_transcription.completed',
        transcript: 'Ciao, mondo.',
      });
      socket.receive({
        type: 'conversation.item.input_audio_transcription.completed',
        transcript: 'Duplicato',
      });
      expect(events.filter((event) => event.type === 'final')).toEqual([
        { sessionId: 'test-session', type: 'final', text: 'Ciao, mondo.' },
      ]);
      expect(socket.closed).toBe(true);
    },
  );

  it('rejects invalid chunks and cancels without publishing a transcript', async () => {
    const { socket, events, session } = await readySession('gpt-live-transcribe');
    expect(() => session.append(Buffer.alloc(3))).toThrow('transcription_invalid_audio');
    expect(events).toEqual([{ sessionId: 'test-session', type: 'error', code: 'invalid_audio' }]);
    socket.receive({
      type: 'conversation.item.input_audio_transcription.completed',
      transcript: 'Late response',
    });
    expect(events.some((event) => event.type === 'final')).toBe(false);
  });
});
