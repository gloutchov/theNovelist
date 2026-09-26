import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { _electron as electron } from 'playwright';

test('packaged app transcribes through local Whisper IPC', async () => {
  const executablePath = process.env['NOVELIST_TEST_PACKAGED_APP'];
  const whisperPath = process.env['NOVELIST_TEST_WHISPER_CLI'];
  const modelPath = process.env['NOVELIST_TEST_WHISPER_MODEL'];
  const audioPath = process.env['NOVELIST_TEST_WHISPER_AUDIO_PCM'];
  test.skip(
    !executablePath || !whisperPath || !modelPath || !audioPath,
    'Provide a packaged app, local Whisper, model and 24 kHz PCM test audio',
  );
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(process.env['NOVELIST_TEST_PACKAGED_TMP'] || tmpdir(), 'novelist-packaged-whisper-'),
  );
  const pcm = await readFile(audioPath!);
  const app = await electron.launch({
    executablePath: executablePath!,
    args: [`--user-data-dir=${path.join(directory, 'profile')}`],
    env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: 'true', OPENAI_API_KEY: '' },
  });
  try {
    const page = app.windows()[0] ?? (await app.waitForEvent('window'));
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: 'The Novelist' })).toBeVisible();
    const text = await page.evaluate(
      async ({ rootPath, binary, model, chunks }) => {
        const api = globalThis.window.novelistApi;
        await api.createProject({ rootPath, name: 'Packaged Whisper Smoke' });
        await api.codexUpdateSettings({
          enabled: false,
          allowApiCalls: false,
          transcriptionEnabled: true,
          transcriptionAllowRemoteAudio: false,
          transcriptionProvider: 'whisper_local',
          transcriptionWhisperExecutablePath: binary,
          transcriptionWhisperModelPath: model,
        });
        const started = await api.transcriptionStart();
        if (started.provider !== 'whisper_local') throw new Error('wrong_provider');
        const result = new Promise<string>((resolve, reject) => {
          const off = api.onTranscriptionEvent((event) => {
            if (event.sessionId !== started.sessionId) return;
            if (event.type === 'final') {
              off();
              resolve(event.text);
            }
            if (event.type === 'error') {
              off();
              reject(new Error(event.code));
            }
          });
        });
        for (const audio of chunks)
          await api.transcriptionAppend({ sessionId: started.sessionId, audio });
        await api.transcriptionStop({ sessionId: started.sessionId });
        return result;
      },
      {
        rootPath: path.join(directory, 'project'),
        binary: whisperPath!,
        model: modelPath!,
        chunks: Array.from({ length: Math.ceil(pcm.length / 48_000) }, (_, index) =>
          pcm
            .subarray(index * 48_000, Math.min((index + 1) * 48_000, pcm.length))
            .toString('base64'),
        ),
      },
    );
    expect(text.toLowerCase()).toMatch(/buongiorno|prova|dettatura/);
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});
