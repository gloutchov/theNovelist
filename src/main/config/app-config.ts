export const APP_CONFIG = {
  appPreferences: {
    fileName: 'app-preferences.json',
    defaultAutosaveMode: 'auto',
    defaultAutosaveIntervalMinutes: 5,
    minAutosaveIntervalMinutes: 1,
    maxAutosaveIntervalMinutes: 120,
  },
  project: {
    dbFileName: 'project.db',
    assetsDirName: 'assets',
    snapshotsDirName: '.snapshots',
    wikiDirName: 'wiki',
  },
  autosave: {
    intervalMs: 30_000,
  },
  snapshots: {
    reasonMaxLength: 30,
  },
  wiki: {
    closeSyncTimeoutMs: 12_000,
    maxSourceReadBytes: 500_000,
    search: {
      defaultLimit: 8,
      maxLimit: 25,
      defaultMaxSnippetLength: 420,
      minMaxSnippetLength: 120,
      maxMaxSnippetLength: 2_000,
      maxFileBytes: 500_000,
    },
    memory: {
      defaultResultLimit: 6,
      defaultMaxChars: 5_500,
    },
  },
  ai: {
    enabledByDefault: false,
    defaultProvider: 'ollama',
    defaultFallbackProvider: 'none',
    allowApiCallsByDefault: false,
    allowExternalMemorySharingByDefault: false,
    autoSummarizeDescriptionsByDefault: true,
    defaultApiModel: 'gpt-5-mini',
    defaultImageModel: 'gpt-image-1',
    defaultOllamaModel: 'gemma4:e4b-it-q4_K_M',
    defaultTimeoutMs: 120_000,
    minTimeoutMs: 1_000,
    maxTimeoutMs: 180_000,
    timeoutEnvVar: 'NOVELIST_CODEX_TIMEOUT_MS',
    imageModelEnvVar: 'NOVELIST_IMAGE_MODEL',
  },
  images: {
    defaultGenerationTimeoutMs: 120_000,
    defaultGeneratedSize: '1024x1024',
    generatedSizes: ['1024x1024', '1536x1024', '1024x1536'],
    maxUploadBytes: 20 * 1024 * 1024,
    generatedImagesDirName: 'generated-images',
    importedImagesDirName: 'img',
    importedExtensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'],
    remoteSources: {
      allowHttp: false,
      allowHttps: false,
    },
  },
  timeline: {
    defaultSettingsUpdatedAt: '1970-01-01T00:00:00.000Z',
  },
} as const;

export type GeneratedImageSize = (typeof APP_CONFIG.images.generatedSizes)[number];
export type ImportedImageExtension = (typeof APP_CONFIG.images.importedExtensions)[number];
