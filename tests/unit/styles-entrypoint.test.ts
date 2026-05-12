import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const stylesPath = resolve(process.cwd(), 'src/renderer/src/styles.css');

describe('renderer CSS entrypoint', () => {
  it('contains only imports to existing CSS modules', () => {
    const content = readFileSync(stylesPath, 'utf8');
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((line) => line.startsWith('@import '))).toBe(true);

    for (const line of lines) {
      const match = line.match(/^@import ['"](.+)['"];$/);
      expect(match, `Import non valido: ${line}`).not.toBeNull();
      if (!match) {
        continue;
      }
      expect(existsSync(resolve(dirname(stylesPath), match[1])), `${match[1]} mancante`).toBe(true);
    }
  });
});
