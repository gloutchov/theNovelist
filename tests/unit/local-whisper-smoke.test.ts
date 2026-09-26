import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { LocalWhisperSession } from '../../src/main/transcription/local-whisper-session';

const executablePath = process.env['NOVELIST_TEST_WHISPER_CLI'];
const modelPath = process.env['NOVELIST_TEST_WHISPER_MODEL'];
const audioPath = process.env['NOVELIST_TEST_WHISPER_AUDIO_PCM'];

it.skipIf(!executablePath || !modelPath || !audioPath)(
  'transcribes a supplied 24 kHz PCM turn with real local Whisper and removes temporary audio',
  async () => {
    const directory = await fs.mkdtemp(path.join(tmpdir(), 'novelist-whisper-smoke-'));
    try {
      const pcm = await fs.readFile(audioPath!);
      expect(pcm.length).toBeGreaterThan(4_800);
      const before = (await fs.readdir(tmpdir())).filter((name) =>
        name.startsWith('novelist-whisper-'),
      );
      const result = new Promise<string>((resolve, reject) => {
        const session = new LocalWhisperSession(
          'smoke',
          {
            executablePath: executablePath!,
            modelPath: modelPath!,
            language: 'it',
          },
          (event) => {
            if (event.type === 'final') resolve(event.text);
            if (event.type === 'error') reject(new Error(event.code));
          },
        );
        for (let offset = 0; offset < pcm.length; offset += 48_000)
          session.append(pcm.subarray(offset, Math.min(offset + 48_000, pcm.length)));
        session.stop();
      });
      const text = await result;
      expect(text.toLowerCase()).toMatch(/buongiorno|prova|dettatura/);
      await new Promise((resolve) => setTimeout(resolve, 200));
      const after = (await fs.readdir(tmpdir())).filter((name) =>
        name.startsWith('novelist-whisper-'),
      );
      expect(after.sort()).toEqual(before.sort());
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  },
  120_000,
);

it.skipIf(!executablePath || !modelPath || !audioPath)(
  'cancels local processing without a transcript or residual WAV',
  async () => {
    const pcm = await fs.readFile(audioPath!);
    const before = (await fs.readdir(tmpdir())).filter((name) =>
      name.startsWith('novelist-whisper-'),
    );
    const events: string[] = [];
    const session = new LocalWhisperSession(
      'cancel-smoke',
      {
        executablePath: executablePath!,
        modelPath: modelPath!,
        language: 'it',
      },
      (event) => events.push(event.type),
    );
    for (let offset = 0; offset < pcm.length; offset += 48_000)
      session.append(pcm.subarray(offset, Math.min(offset + 48_000, pcm.length)));
    session.stop();
    await new Promise((resolve) => setTimeout(resolve, 10));
    session.cancel();
    await new Promise((resolve) => setTimeout(resolve, 600));
    const after = (await fs.readdir(tmpdir())).filter((name) =>
      name.startsWith('novelist-whisper-'),
    );
    expect(events).not.toContain('final');
    expect(after.sort()).toEqual(before.sort());
  },
  120_000,
);
