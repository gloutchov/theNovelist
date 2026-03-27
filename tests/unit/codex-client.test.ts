import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { __testing, CodexCliService } from '../../src/main/codex/client';

const originalCommand = process.env['NOVELIST_CODEX_COMMAND'];
const originalTimeout = process.env['NOVELIST_CODEX_TIMEOUT_MS'];
const tempDirs: string[] = [];

async function createTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  if (originalCommand === undefined) {
    delete process.env['NOVELIST_CODEX_COMMAND'];
  } else {
    process.env['NOVELIST_CODEX_COMMAND'] = originalCommand;
  }

  if (originalTimeout === undefined) {
    delete process.env['NOVELIST_CODEX_TIMEOUT_MS'];
  } else {
    process.env['NOVELIST_CODEX_TIMEOUT_MS'] = originalTimeout;
  }
});

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('CodexCliService', () => {
  it('uses macOS login shell candidates', () => {
    const candidates = __testing.getLoginShellCandidates('darwin', {});

    expect(candidates).toContain('/bin/zsh');
    expect(candidates).toContain('/bin/sh');
    expect(candidates).toContain('/bin/bash');
  });

  it('searches common macOS command locations for Codex CLI', () => {
    const env = {
      HOME: '/Users/Writer',
    };
    const candidates = __testing.getCommonCommandCandidates('codex', env);

    expect(candidates).toContain('/opt/homebrew/bin/codex');
    expect(candidates).toContain('/usr/local/bin/codex');
    expect(candidates).toContain('/Users/Writer/.local/bin/codex');
  });

  it('does not require a shell to spawn macOS executables', () => {
    expect(__testing.shouldUseShellForSpawn('/opt/homebrew/bin/codex', 'darwin')).toBe(false);
    expect(__testing.shouldUseShellForSpawn('/usr/local/bin/codex', 'darwin')).toBe(false);
  });

  it('returns fallback transform when CLI command is unavailable', async () => {
    process.env['NOVELIST_CODEX_COMMAND'] = '__missing_codex_cli__';
    const service = new CodexCliService();

    const result = await service.transformSelection({
      action: 'correggi',
      selectedText: '  testo   con  spazi  ',
      chapterTitle: 'Capitolo 1',
    });

    expect(result.mode).toBe('fallback');
    expect(result.output).toBe('Testo con spazi');
  });

  it('returns fallback chat response when CLI command is unavailable', async () => {
    process.env['NOVELIST_CODEX_COMMAND'] = '__missing_codex_cli__';
    const service = new CodexCliService();

    const result = await service.chat({
      message: 'Dammi idee per un colpo di scena.',
      chapterTitle: 'Capitolo 3',
    });

    expect(result.mode).toBe('fallback');
    expect(result.output).toContain('Modalita fallback locale attiva');
  });

  it('cancels the active Codex CLI request', async () => {
    const dir = await createTempDir('novelist-codex-');
    const commandPath = path.join(dir, 'fake-codex.sh');
    await writeFile(
      commandPath,
      '#!/bin/sh\nif [ "$1" = "exec" ]; then\n  sleep 5\n  echo "output from cli"\nfi\n',
      'utf8',
    );
    await chmod(commandPath, 0o755);

    process.env['NOVELIST_CODEX_COMMAND'] = commandPath;
    process.env['NOVELIST_CODEX_TIMEOUT_MS'] = '10000';

    const service = new CodexCliService();
    const promise = service.transformSelection({
      action: 'riscrivi',
      selectedText: 'testo da riscrivere',
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(service.cancelActiveRequest()).toBe(true);

    const result = await promise;
    expect(result.cancelled).toBe(true);
    expect(result.output).toBe('');
  });
});
