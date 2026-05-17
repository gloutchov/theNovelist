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

  it('builds English chat prompts without translating project content', () => {
    const prompt = __testing.buildChatPrompt(
      {
        message: 'Come miglioro il ritmo?',
        projectName: 'Romanzo Italiano',
        chapterTitle: 'Capitolo 1',
        chapterText: 'Tizio firma il patto nel magazzino.',
        projectMemoryContext: '[1] Magazzino (sources/chapters/chapter-1.md)',
      },
      'en',
    );

    expect(prompt).toContain('You are an editorial assistant');
    expect(prompt).toContain('Reply in English');
    expect(prompt).toContain('Current chapter: Capitolo 1');
    expect(prompt).toContain('Tizio firma il patto nel magazzino.');
    expect(prompt).toContain('[1] Magazzino');
    expect(prompt).not.toContain('Rispondi in italiano');
  });

  it('builds English transform prompts while preserving selected text', () => {
    const prompt = __testing.buildTransformPrompt(
      {
        action: 'riscrivi',
        selectedText: 'La porta si apre lentamente.',
        chapterTitle: 'Capitolo 2',
      },
      'en',
    );

    expect(prompt).toContain('You are a professional narrative editor.');
    expect(prompt).toContain('Requested action: riscrivi.');
    expect(prompt).toContain('Return only the final text');
    expect(prompt).toContain('La porta si apre lentamente.');
  });
});
