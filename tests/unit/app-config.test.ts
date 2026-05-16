import { describe, expect, it } from 'vitest';
import { APP_CONFIG } from '../../src/main/config/app-config';

describe('APP_CONFIG', () => {
  it('centralizes AI defaults used by new projects', () => {
    expect(APP_CONFIG.ai.enabledByDefault).toBe(false);
    expect(APP_CONFIG.ai.defaultProvider).toBe('ollama');
    expect(APP_CONFIG.ai.defaultFallbackProvider).toBe('none');
    expect(APP_CONFIG.ai.allowApiCallsByDefault).toBe(false);
    expect(APP_CONFIG.ai.allowExternalMemorySharingByDefault).toBe(false);
    expect(APP_CONFIG.ai.defaultApiModel).toBe('gpt-5-mini');
    expect(APP_CONFIG.ai.defaultImageModel).toBe('gpt-image-1');
    expect(APP_CONFIG.ai.defaultOllamaModel).toBe('gemma4:e4b-it-q4_K_M');
  });

  it('centralizes app preference defaults', () => {
    expect(APP_CONFIG.appPreferences.defaultAutosaveMode).toBe('auto');
    expect(APP_CONFIG.appPreferences.defaultLanguageMode).toBe('auto');
  });

  it('documents local-only image policy for hardening work', () => {
    expect(APP_CONFIG.images.remoteSources.allowHttp).toBe(false);
    expect(APP_CONFIG.images.remoteSources.allowHttps).toBe(false);
    expect(APP_CONFIG.images.maxUploadBytes).toBe(20 * 1024 * 1024);
    expect(APP_CONFIG.images.generatedImagesDirName).toBe('generated-images');
    expect(APP_CONFIG.images.importedImagesDirName).toBe('img');
  });
});
