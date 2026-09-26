import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { APP_CONFIG } from '../config/app-config';
import type { TranscriptionEvent } from './realtime-session';

export interface LocalWhisperOptions {
  executablePath: string;
  modelPath: string;
  language: 'auto' | 'it' | 'en';
}

export async function validateLocalWhisper(options: LocalWhisperOptions): Promise<void> {
  const executable = options.executablePath.trim();
  const model = options.modelPath.trim();
  if (
    !path.isAbsolute(executable) ||
    !/^whisper-cli(?:\.exe)?$/i.test(path.basename(executable)) ||
    !path.isAbsolute(model) ||
    !model.toLowerCase().endsWith('.bin')
  ) {
    throw new Error('transcription_local_unavailable');
  }
  try {
    const [binaryStat, modelStat] = await Promise.all([fs.stat(executable), fs.stat(model)]);
    if (!binaryStat.isFile() || !modelStat.isFile() || modelStat.size < 1_000_000) {
      throw new Error('invalid');
    }
    if (process.platform !== 'win32') await fs.access(executable, fs.constants.X_OK);
  } catch {
    throw new Error('transcription_local_unavailable');
  }
}

function toWav(pcm24k: Buffer): Buffer {
  const inputSamples = pcm24k.length / 2;
  const outputSamples = Math.floor((inputSamples * 2) / 3);
  const wav = Buffer.allocUnsafe(44 + outputSamples * 2);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(16_000, 24);
  wav.writeUInt32LE(32_000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(outputSamples * 2, 40);
  for (let i = 0; i < outputSamples; i += 1) {
    const source = i * 1.5;
    const left = Math.floor(source);
    const right = Math.min(left + 1, inputSamples - 1);
    const leftSample = pcm24k.readInt16LE(left * 2);
    const rightSample = pcm24k.readInt16LE(right * 2);
    wav.writeInt16LE(
      Math.round(leftSample + (rightSample - leftSample) * (source - left)),
      44 + i * 2,
    );
  }
  return wav;
}

export class LocalWhisperSession {
  private chunks: Buffer[] = [];
  private bytes = 0;
  private phase: 'recording' | 'stopping' | 'closed' = 'recording';
  private process: ChildProcess | null = null;
  private limitTimer: ReturnType<typeof setTimeout>;

  constructor(
    readonly id: string,
    private readonly options: LocalWhisperOptions,
    private readonly onEvent: (event: TranscriptionEvent) => void,
  ) {
    this.limitTimer = setTimeout(() => this.fail('limit'), APP_CONFIG.transcription.maxDurationMs);
  }

  append(pcm: Buffer): void {
    if (this.phase !== 'recording') throw new Error('transcription_session_not_ready');
    if (
      pcm.length === 0 ||
      pcm.length % 2 !== 0 ||
      pcm.length > APP_CONFIG.transcription.maxChunkBytes
    ) {
      this.fail('invalid_audio');
      throw new Error('transcription_invalid_audio');
    }
    if (this.bytes + pcm.length > APP_CONFIG.transcription.maxAudioBytes) {
      this.fail('limit');
      throw new Error('transcription_audio_limit');
    }
    this.chunks.push(Buffer.from(pcm));
    this.bytes += pcm.length;
  }

  stop(): void {
    if (this.phase !== 'recording' || this.bytes < 4_800) {
      this.fail('invalid_audio');
      throw new Error('transcription_audio_too_short');
    }
    this.phase = 'stopping';
    clearTimeout(this.limitTimer);
    void this.transcribe();
  }

  cancel(): void {
    if (this.phase === 'closed') return;
    this.phase = 'closed';
    clearTimeout(this.limitTimer);
    for (const chunk of this.chunks) chunk.fill(0);
    this.chunks = [];
    this.process?.kill();
  }

  private isClosed(): boolean {
    return this.phase === 'closed';
  }

  private fail(code: Extract<TranscriptionEvent, { type: 'error' }>['code']): void {
    if (this.phase === 'closed') return;
    this.onEvent({ sessionId: this.id, type: 'error', code });
    this.cancel();
  }

  private async transcribe(): Promise<void> {
    let directory: string | null = null;
    try {
      directory = await fs.mkdtemp(path.join(tmpdir(), 'novelist-whisper-'));
      await fs.chmod(directory, 0o700);
      if (this.isClosed()) return;
      const audioPath = path.join(directory, `${randomUUID()}.wav`);
      const outputPath = path.join(directory, 'transcript');
      const source = Buffer.concat(this.chunks, this.bytes);
      for (const chunk of this.chunks) chunk.fill(0);
      this.chunks = [];
      const audio = toWav(source);
      source.fill(0);
      await fs.writeFile(audioPath, audio, { mode: 0o600 });
      audio.fill(0);
      if (this.isClosed()) return;
      await new Promise<void>((resolve, reject) => {
        const child = spawn(
          this.options.executablePath,
          [
            '-m',
            this.options.modelPath,
            '-f',
            audioPath,
            '-l',
            this.options.language,
            '-otxt',
            '-of',
            outputPath,
            '-np',
            '-ng',
          ],
          {
            cwd: directory!,
            stdio: 'ignore',
            shell: false,
            env: Object.fromEntries(
              ['PATH', 'HOME', 'TMPDIR', 'TEMP', 'TMP', 'SystemRoot'].flatMap((key) =>
                process.env[key] ? [[key, process.env[key]]] : [],
              ),
            ),
          },
        );
        this.process = child;
        let timedOut = false;
        const timer = setTimeout(() => {
          timedOut = true;
          child.kill();
        }, APP_CONFIG.transcription.localTimeoutMs);
        child.once('error', (error) => {
          clearTimeout(timer);
          reject(error);
        });
        child.once('close', (code) => {
          clearTimeout(timer);
          if (timedOut) reject(new Error('timeout'));
          else if (code === 0) resolve();
          else reject(new Error('local_failed'));
        });
      });
      if (this.isClosed()) return;
      const outputFile = `${outputPath}.txt`;
      if ((await fs.stat(outputFile)).size > 1_000_000) throw new Error('local_failed');
      const transcript = await fs.readFile(outputFile, 'utf8');
      if (this.phase === 'closed') return;
      this.onEvent({ sessionId: this.id, type: 'final', text: transcript.trim().slice(0, 20_000) });
      this.cancel();
    } catch (error) {
      this.fail(error instanceof Error && error.message === 'timeout' ? 'timeout' : 'local_failed');
    } finally {
      this.process = null;
      if (directory)
        await fs
          .rm(directory, {
            recursive: true,
            force: true,
            maxRetries: 5,
            retryDelay: 100,
          })
          .catch(() => undefined);
    }
  }
}
