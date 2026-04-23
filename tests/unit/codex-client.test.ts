import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
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
  __testing.clearResolvedCommandCaches();

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
    const candidates = __testing.getCommonCommandCandidates('codex', env, 'darwin');

    expect(candidates).toContain('/opt/homebrew/bin/codex');
    expect(candidates).toContain('/usr/local/bin/codex');
    expect(candidates).toContain('/Users/Writer/.local/bin/codex');
  });

  it('searches common Windows npm command locations for Codex CLI', () => {
    const env = {
      APPDATA: 'C:\\Users\\Writer\\AppData\\Roaming',
      LOCALAPPDATA: 'C:\\Users\\Writer\\AppData\\Local',
      PATHEXT: '.COM;.EXE;.BAT;.CMD',
    };
    const candidates = __testing.getCommonCommandCandidates('codex', env, 'win32');

    expect(candidates).toContain('C:\\Users\\Writer\\AppData\\Roaming\\npm\\codex.cmd');
    expect(candidates).toContain('C:\\Users\\Writer\\AppData\\Roaming\\npm\\codex.exe');
    expect(candidates).toContain(
      'C:\\Users\\Writer\\AppData\\Local\\Programs\\nodejs\\codex.cmd',
    );
    expect(candidates[0]).toBe('C:\\Users\\Writer\\AppData\\Roaming\\npm\\codex.exe');
    expect(candidates[1]).toBe('C:\\Users\\Writer\\AppData\\Roaming\\npm\\codex.cmd');
  });

  it.runIf(process.platform !== 'win32')(
    'prefers runtime common paths over login shell resolution for Codex CLI',
    async () => {
      const fakeHome = await createTempDir('novelist-codex-home-');
      const fakeCodexDir = path.join(fakeHome, '.local', 'bin');
      const fakeCodexPath = path.join(fakeCodexDir, 'codex');
      await mkdir(fakeCodexDir, { recursive: true });
      await writeFile(fakeCodexPath, '#!/bin/sh\necho ok\n', 'utf8');
      await chmod(fakeCodexPath, 0o755);

      const originalHome = process.env['HOME'];
      process.env['HOME'] = fakeHome;

      try {
        const resolved = await __testing.resolveRunnableCommandName('codex');
        expect(resolved).toBe(fakeCodexPath);
      } finally {
        if (originalHome === undefined) {
          delete process.env['HOME'];
        } else {
          process.env['HOME'] = originalHome;
        }
      }
    },
  );

  it.runIf(process.platform === 'win32')(
    'prefers Windows npm command wrappers over PATH lookup for Codex CLI',
    async () => {
      const fakeAppData = await createTempDir('novelist-codex-appdata-');
      const fakeCodexDir = path.join(fakeAppData, 'npm');
      const fakeCodexPath = path.join(fakeCodexDir, 'codex.cmd');
      await mkdir(fakeCodexDir, { recursive: true });
      await writeFile(fakeCodexPath, '@echo off\r\necho ok\r\n', 'utf8');

      const originalAppData = process.env['APPDATA'];
      process.env['APPDATA'] = fakeAppData;

      try {
        const resolved = await __testing.resolveRunnableCommandName('codex');
        expect(resolved).toBe(fakeCodexPath);
      } finally {
        if (originalAppData === undefined) {
          delete process.env['APPDATA'];
        } else {
          process.env['APPDATA'] = originalAppData;
        }
      }
    },
  );

  it.runIf(process.platform === 'win32')(
    'normalizes explicit Windows Codex paths without extension to cmd wrappers',
    async () => {
      const fakeAppData = await createTempDir('novelist-codex-explicit-');
      const fakeCodexDir = path.join(fakeAppData, 'npm');
      const fakeCodexBasePath = path.join(fakeCodexDir, 'codex');
      const fakeCodexCmdPath = path.join(fakeCodexDir, 'codex.cmd');
      await mkdir(fakeCodexDir, { recursive: true });
      await writeFile(fakeCodexBasePath, '#!/bin/sh\necho wrong\n', 'utf8');
      await writeFile(fakeCodexCmdPath, '@echo off\r\necho ok\r\n', 'utf8');

      process.env['NOVELIST_CODEX_COMMAND'] = fakeCodexBasePath;

      const resolved = await __testing.resolveRunnableCommandName(fakeCodexBasePath);
      expect(resolved).toBe(fakeCodexCmdPath);
    },
  );

  it('does not require a shell to spawn macOS executables', () => {
    expect(__testing.shouldUseShellForSpawn('/opt/homebrew/bin/codex', 'darwin')).toBe(false);
    expect(__testing.shouldUseShellForSpawn('/usr/local/bin/codex', 'darwin')).toBe(false);
  });

  it('prefers Windows command launchers that can be spawned from Electron', () => {
    const selected = __testing.selectWindowsCommandCandidate(
      [
        'C:\\Users\\Writer\\AppData\\Roaming\\npm\\codex',
        'C:\\Users\\Writer\\AppData\\Roaming\\npm\\codex.cmd',
        'C:\\Users\\Writer\\AppData\\Roaming\\npm\\codex.ps1',
      ].join('\r\n'),
    );

    expect(selected).toBe('C:\\Users\\Writer\\AppData\\Roaming\\npm\\codex.cmd');
  });

  it('uses a shell to spawn Windows command wrappers', () => {
    expect(
      __testing.shouldUseShellForSpawn(
        'C:\\Users\\Writer\\AppData\\Roaming\\npm\\codex.cmd',
        'win32',
      ),
    ).toBe(true);
    expect(
      __testing.shouldUseShellForSpawn('C:\\Users\\Writer\\AppData\\Roaming\\npm\\codex.exe', 'win32'),
    ).toBe(false);
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
    const commandPath = path.join(
      dir,
      process.platform === 'win32' ? 'fake-codex.cmd' : 'fake-codex.sh',
    );
    const commandBody =
      process.platform === 'win32'
        ? '@echo off\r\nif "%1"=="exec" (\r\n  ping -n 6 127.0.0.1 >NUL\r\n  echo output from cli\r\n)\r\n'
        : '#!/bin/sh\nif [ "$1" = "exec" ]; then\n  sleep 5\n  echo "output from cli"\nfi\n';
    await writeFile(commandPath, commandBody, 'utf8');
    if (process.platform !== 'win32') {
      await chmod(commandPath, 0o755);
    }

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
  }, 10000);
});
