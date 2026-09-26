import WebSocket from 'ws';
import { APP_CONFIG } from '../config/app-config';

export type TranscriptionEvent =
  | { sessionId: string; type: 'partial'; text: string }
  | { sessionId: string; type: 'final'; text: string }
  | {
      sessionId: string;
      type: 'error';
      code: 'connection' | 'service' | 'timeout' | 'limit' | 'invalid_audio' | 'model_unavailable';
    };

type TranscriptionModel = 'gpt-live-transcribe' | 'gpt-realtime-whisper';
type TranscriptionLanguage = 'auto' | 'it' | 'en';
type SocketFactory = (url: string, apiKey: string) => WebSocket;

const defaultSocketFactory: SocketFactory = (url, apiKey) =>
  new WebSocket(url, { headers: { Authorization: `Bearer ${apiKey}` } });

export class RealtimeTranscriptionSession {
  private socket: WebSocket | null = null;
  private phase: 'connecting' | 'recording' | 'stopping' | 'closed' = 'connecting';
  private bytesSent = 0;
  private partial = '';
  private limitTimer: ReturnType<typeof setTimeout> | null = null;
  private finalTimer: ReturnType<typeof setTimeout> | null = null;
  private abortConnect: (() => void) | null = null;

  constructor(
    readonly id: string,
    private readonly model: TranscriptionModel,
    private readonly language: TranscriptionLanguage,
    private readonly onEvent: (event: TranscriptionEvent) => void,
    private readonly socketFactory: SocketFactory = defaultSocketFactory,
  ) {}

  async start(apiKey: string): Promise<void> {
    const socket = this.socketFactory(
      'wss://api.openai.com/v1/realtime?intent=transcription',
      apiKey,
    );
    this.socket = socket;
    let settled = false;
    await new Promise<void>((resolve, reject) => {
      const connectTimer = setTimeout(
        () => failConnect('transcription_connection_timeout'),
        APP_CONFIG.transcription.connectTimeoutMs,
      );
      this.abortConnect = () => {
        if (settled) return;
        settled = true;
        clearTimeout(connectTimer);
        reject(new Error('transcription_cancelled'));
      };
      const failConnect = (code = 'transcription_connection_failed') => {
        if (settled) return;
        settled = true;
        clearTimeout(connectTimer);
        this.abortConnect = null;
        this.cancel();
        reject(new Error(code));
      };
      socket.on('open', () => {
        const transcription: Record<string, unknown> = { model: this.model };
        if (this.language !== 'auto') {
          transcription[this.model === 'gpt-live-transcribe' ? 'languages' : 'language'] =
            this.model === 'gpt-live-transcribe' ? [this.language] : this.language;
        }
        socket.send(
          JSON.stringify({
            type: 'session.update',
            session: {
              type: 'transcription',
              audio: {
                input: {
                  format: { type: 'audio/pcm', rate: 24_000 },
                  transcription,
                  turn_detection: null,
                },
              },
            },
          }),
        );
      });
      socket.on('message', (data) => {
        let event: Record<string, unknown>;
        try {
          event = JSON.parse(data.toString()) as Record<string, unknown>;
        } catch {
          this.fail('service');
          failConnect();
          return;
        }
        if (event['type'] === 'session.updated' && !settled) {
          settled = true;
          clearTimeout(connectTimer);
          this.abortConnect = null;
          this.phase = 'recording';
          this.limitTimer = setTimeout(
            () => this.fail('limit'),
            APP_CONFIG.transcription.maxDurationMs,
          );
          resolve();
          return;
        }
        if (
          event['type'] === 'error' ||
          event['type'] === 'conversation.item.input_audio_transcription.failed'
        ) {
          const detail = event['error'];
          const code =
            typeof detail === 'object' && detail !== null && 'code' in detail
              ? String(detail.code)
              : '';
          const failure =
            code === 'invalid_model' || code === 'model_not_found'
              ? 'model_unavailable'
              : 'service';
          if (settled) this.fail(failure);
          else
            failConnect(
              failure === 'model_unavailable'
                ? 'transcription_model_unavailable'
                : 'transcription_connection_failed',
            );
          return;
        }
        if (
          event['type'] === 'conversation.item.input_audio_transcription.delta' &&
          typeof event['delta'] === 'string' &&
          this.phase !== 'closed'
        ) {
          this.partial = (this.partial + event['delta']).slice(0, 20_000);
          this.onEvent({ sessionId: this.id, type: 'partial', text: this.partial });
        }
        if (
          event['type'] === 'conversation.item.input_audio_transcription.completed' &&
          typeof event['transcript'] === 'string' &&
          this.phase === 'stopping'
        ) {
          this.onEvent({
            sessionId: this.id,
            type: 'final',
            text: event['transcript'].slice(0, 20_000),
          });
          this.cancel();
        }
      });
      socket.on('error', () => {
        this.fail('connection');
        failConnect();
      });
      socket.on('close', () => {
        if (this.phase !== 'closed') {
          this.fail('connection');
          failConnect();
        }
      });
    });
  }

  append(pcm: Buffer): void {
    if (this.phase !== 'recording' || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('transcription_session_not_ready');
    }
    if (
      pcm.length === 0 ||
      pcm.length % 2 !== 0 ||
      pcm.length > APP_CONFIG.transcription.maxChunkBytes
    ) {
      this.fail('invalid_audio');
      throw new Error('transcription_invalid_audio');
    }
    if (
      this.bytesSent + pcm.length > APP_CONFIG.transcription.maxAudioBytes ||
      this.socket.bufferedAmount > 1_000_000
    ) {
      this.fail('limit');
      throw new Error('transcription_audio_limit');
    }
    this.socket.send(
      JSON.stringify({ type: 'input_audio_buffer.append', audio: pcm.toString('base64') }),
    );
    this.bytesSent += pcm.length;
  }

  stop(): void {
    if (this.phase !== 'recording' || !this.socket || this.bytesSent < 4_800) {
      this.fail('invalid_audio');
      throw new Error('transcription_audio_too_short');
    }
    this.phase = 'stopping';
    if (this.limitTimer) clearTimeout(this.limitTimer);
    this.socket.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
    this.finalTimer = setTimeout(
      () => this.fail('timeout'),
      APP_CONFIG.transcription.finalTimeoutMs,
    );
  }

  cancel(): void {
    if (this.phase === 'closed') return;
    this.abortConnect?.();
    this.abortConnect = null;
    this.phase = 'closed';
    if (this.limitTimer) clearTimeout(this.limitTimer);
    if (this.finalTimer) clearTimeout(this.finalTimer);
    if (this.socket?.readyState === WebSocket.CONNECTING) {
      this.socket.terminate();
    } else if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.close();
    }
  }

  private fail(code: Extract<TranscriptionEvent, { type: 'error' }>['code']): void {
    if (this.phase === 'closed') return;
    this.onEvent({ sessionId: this.id, type: 'error', code });
    this.cancel();
  }
}
