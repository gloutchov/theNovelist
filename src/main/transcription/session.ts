import { APP_CONFIG } from '../config/app-config';
import {
  LocalWhisperSession,
  validateLocalWhisper,
  type LocalWhisperOptions,
} from './local-whisper-session';
import { RealtimeTranscriptionSession, type TranscriptionEvent } from './realtime-session';

interface Options {
  provider: 'openai_api' | 'whisper_local';
  fallbackProvider: 'none' | 'whisper_local';
  model: 'gpt-live-transcribe' | 'gpt-realtime-whisper';
  language: 'auto' | 'it' | 'en';
  local: LocalWhisperOptions;
}

export class TranscriptionSession {
  private remote: RealtimeTranscriptionSession | null = null;
  private local: LocalWhisperSession | null = null;
  private fallbackChunks: Buffer[] = [];
  private bufferedBytes = 0;
  private ready = false;
  private stopped = false;
  private closed = false;
  private finalSent = false;
  private provider: 'openai_api' | 'whisper_local';
  private fallbackUsed = false;

  constructor(
    readonly id: string,
    private readonly options: Options,
    private readonly onEvent: (event: TranscriptionEvent) => void,
  ) {
    this.provider = options.provider;
  }

  get activeProvider(): 'openai_api' | 'whisper_local' {
    return this.provider;
  }
  get usedFallback(): boolean {
    return this.fallbackUsed;
  }

  async start(apiKey: string | null): Promise<void> {
    if (
      this.options.provider === 'whisper_local' ||
      this.options.fallbackProvider === 'whisper_local'
    ) {
      await validateLocalWhisper(this.options.local);
    }
    if (this.closed) throw new Error('transcription_cancelled');
    if (this.options.provider === 'whisper_local') {
      this.local = new LocalWhisperSession(this.id, this.options.local, (event) =>
        this.emit(event),
      );
      this.emit({
        sessionId: this.id,
        type: 'provider',
        provider: 'whisper_local',
        reason: 'primary',
      });
      return;
    }
    if (!apiKey && this.options.fallbackProvider === 'whisper_local') {
      this.switchToLocal();
      return;
    }
    if (!apiKey) throw new Error('transcription_api_key_required');
    this.remote = new RealtimeTranscriptionSession(
      this.id,
      this.options.model,
      this.options.language,
      (event) => this.onRemote(event),
    );
    try {
      await this.remote.start(apiKey);
      if (this.closed) throw new Error('transcription_cancelled');
      this.ready = true;
      this.emit({
        sessionId: this.id,
        type: 'provider',
        provider: 'openai_api',
        reason: 'primary',
      });
    } catch (error) {
      if (this.closed) throw error;
      if (this.options.fallbackProvider === 'whisper_local') {
        this.switchToLocal();
        return;
      }
      throw error;
    }
  }

  append(pcm: Buffer): void {
    if (this.closed || this.stopped) throw new Error('transcription_session_not_ready');
    if (this.local) {
      this.local.append(pcm);
      return;
    }
    if (!this.remote) throw new Error('transcription_session_not_ready');
    if (this.options.fallbackProvider === 'whisper_local') {
      if (this.bufferedBytes + pcm.length > APP_CONFIG.transcription.maxAudioBytes) {
        this.emit({ sessionId: this.id, type: 'error', code: 'limit' });
        this.cancel();
        throw new Error('transcription_audio_limit');
      }
      this.fallbackChunks.push(Buffer.from(pcm));
      this.bufferedBytes += pcm.length;
    }
    this.remote.append(pcm);
  }

  stop(): void {
    if (this.closed || this.stopped) throw new Error('transcription_session_not_ready');
    this.stopped = true;
    if (this.local) this.local.stop();
    else if (this.remote) this.remote.stop();
  }

  cancel(): void {
    if (this.closed) return;
    this.closed = true;
    this.remote?.cancel();
    this.local?.cancel();
    for (const chunk of this.fallbackChunks) chunk.fill(0);
    this.fallbackChunks = [];
    this.bufferedBytes = 0;
  }

  private onRemote(event: TranscriptionEvent): void {
    if (this.closed || this.provider !== 'openai_api') return;
    if (event.type === 'error') {
      if (!this.ready) return;
      if (
        this.options.fallbackProvider === 'whisper_local' &&
        ['connection', 'service', 'timeout', 'model_unavailable'].includes(event.code)
      ) {
        this.switchToLocal();
        return;
      }
    }
    this.emit(event);
  }

  private switchToLocal(): void {
    if (this.closed || this.local) return;
    this.remote?.cancel();
    this.provider = 'whisper_local';
    this.fallbackUsed = true;
    this.local = new LocalWhisperSession(this.id, this.options.local, (event) => this.emit(event));
    this.emit({
      sessionId: this.id,
      type: 'provider',
      provider: 'whisper_local',
      reason: 'fallback',
    });
    const chunks = this.fallbackChunks;
    this.fallbackChunks = [];
    this.bufferedBytes = 0;
    try {
      for (const chunk of chunks) this.local.append(chunk);
      for (const chunk of chunks) chunk.fill(0);
      if (this.stopped) this.local.stop();
    } catch {
      for (const chunk of chunks) chunk.fill(0);
      this.emit({ sessionId: this.id, type: 'error', code: 'local_failed' });
    }
  }

  private emit(event: TranscriptionEvent): void {
    if (this.closed || this.finalSent) return;
    if (event.type === 'final') this.finalSent = true;
    this.onEvent(event);
    if (event.type === 'final' || event.type === 'error') this.cancel();
  }
}
