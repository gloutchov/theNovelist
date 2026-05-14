import { describe, expect, it } from 'vitest';
import { __testing, CodexCliService } from '../../src/main/codex/client';

describe('CodexCliService', () => {
  it('normalizes removed Codex CLI settings to the supported default provider', async () => {
    const service = new CodexCliService();

    const status = await service.getStatus({
      provider: 'codex_cli' as never,
      fallbackProvider: 'codex_cli' as never,
      allowApiCalls: false,
    });

    expect(status.provider).toBe('ollama');
    expect(status.fallbackProvider).toBe('none');
  });

  it('does not use a CLI fallback when OpenAI API is selected with non-AI fallback', async () => {
    const service = new CodexCliService();

    const result = await service.chat(
      {
        message: 'Dammi idee per un colpo di scena.',
        chapterTitle: 'Capitolo 3',
      },
      {
        provider: 'openai_api',
        fallbackProvider: 'none',
        allowApiCalls: true,
        apiKey: null,
      },
    );

    expect(result.mode).toBe('fallback');
    expect(result.output).toContain('Modalita fallback locale attiva');
    expect(result.error).toContain('API key mancante');
  });

  it('adds project memory and citation rules to chat prompts', () => {
    const prompt = __testing.buildChatPrompt({
      message: 'Dove avviene il patto?',
      chapterTitle: 'Capitolo 1',
      projectMemoryContext:
        '[1] Il magazzino (source) - sources/chapters/chapter-1.md\nTizio firma il patto nel magazzino.',
    });

    expect(prompt).toContain('Memoria progetto');
    expect(prompt).toContain('sources/chapters/chapter-1.md');
    expect(prompt).toContain('cita i riferimenti disponibili');
    expect(prompt).toContain('non hai trovato conferma');
  });
});
