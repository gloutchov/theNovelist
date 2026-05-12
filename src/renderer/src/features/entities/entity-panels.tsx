import type { ReactElement } from 'react';

export type EntityImageSize = '1024x1024' | '1536x1024' | '1024x1536';

export interface EntityImageAsset {
  id: string;
  imageType: string;
  filePath: string;
}

interface ImageTypeOption {
  value: string;
  label: string;
}

interface LinkedChaptersPanelProps<TChapter extends { id: string }> {
  chapters: TChapter[];
  formatChapterLabel: (chapter: TChapter) => string;
}

interface EntityImageSectionProps<TImage extends EntityImageAsset> {
  aiAssistantLabel: string;
  codexPrompting: boolean;
  imageGenerating: boolean;
  imageGenerationReady: boolean;
  imagePath: string;
  imagePreviewSources: Record<string, string>;
  imagePrompt: string;
  images: TImage[];
  imageSize: EntityImageSize;
  imageType: string;
  imageTypeOptions: ImageTypeOption[];
  missingImageGenerationRequirements: string[];
  previewErrors: string[];
  onAddImage: () => void | Promise<void>;
  onCodexImagePrompt: () => void | Promise<void>;
  onDeleteImage: (imageId: string) => void | Promise<void>;
  onGenerateImage: () => void | Promise<void>;
  onImagePathChange: (value: string) => void;
  onImagePromptChange: (value: string) => void;
  onImageSizeChange: (value: EntityImageSize) => void;
  onImageTypeChange: (value: string) => void;
  onPreviewError: (imageId: string) => void;
  onSelectImagePath: () => void | Promise<void>;
  onViewImage: (image: TImage) => void;
}

interface ImageViewerModalProps {
  viewerImage: { src: string; label: string } | null;
  onClose: () => void;
}

const IMAGE_SIZE_OPTIONS: { value: EntityImageSize; label: string }[] = [
  { value: '1024x1024', label: 'Quadrata (1024x1024)' },
  { value: '1536x1024', label: 'Orizzontale (1536x1024)' },
  { value: '1024x1536', label: 'Verticale (1024x1536)' },
];

export function LinkedChaptersPanel<TChapter extends { id: string }>({
  chapters,
  formatChapterLabel,
}: LinkedChaptersPanelProps<TChapter>): ReactElement {
  return (
    <div className="panel panel-subsection">
      <h4>Capitoli Collegati</h4>
      <div className="chapter-links-list">
        {chapters.length === 0 ? <p className="muted">Nessun capitolo collegato.</p> : null}
        <div className="chapter-badge-list">
          {chapters.map((chapter) => (
            <span key={chapter.id} className="chapter-link-badge">
              {formatChapterLabel(chapter)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function EntityImageSection<TImage extends EntityImageAsset>({
  aiAssistantLabel,
  codexPrompting,
  imageGenerating,
  imageGenerationReady,
  imagePath,
  imagePreviewSources,
  imagePrompt,
  images,
  imageSize,
  imageType,
  imageTypeOptions,
  missingImageGenerationRequirements,
  previewErrors,
  onAddImage,
  onCodexImagePrompt,
  onDeleteImage,
  onGenerateImage,
  onImagePathChange,
  onImagePromptChange,
  onImageSizeChange,
  onImageTypeChange,
  onPreviewError,
  onSelectImagePath,
  onViewImage,
}: EntityImageSectionProps<TImage>): ReactElement {
  return (
    <div className="panel panel-subsection">
      <h4>Immagini Associate</h4>
      <div className="grid-two">
        <label>
          Tipo
          <select value={imageType} onChange={(event) => onImageTypeChange(event.target.value)}>
            {imageTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Path file immagine
          <div className="input-with-button">
            <input value={imagePath} onChange={(event) => onImagePathChange(event.target.value)} />
            <button
              type="button"
              className="button-secondary"
              onClick={() => void onSelectImagePath()}
            >
              Sfoglia...
            </button>
          </div>
        </label>
        <label>
          Dimensione
          <select
            value={imageSize}
            onChange={(event) => onImageSizeChange(event.target.value as EntityImageSize)}
          >
            {IMAGE_SIZE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Prompt
        <textarea
          rows={3}
          value={imagePrompt}
          onChange={(event) => onImagePromptChange(event.target.value)}
        />
      </label>
      <div className="row-buttons">
        <button
          type="button"
          onClick={() => void onCodexImagePrompt()}
          className={codexPrompting ? 'ai-working' : undefined}
          disabled={codexPrompting}
        >
          {`Prompt Da ${aiAssistantLabel}`}
        </button>
        <button
          type="button"
          onClick={() => void onGenerateImage()}
          disabled={imageGenerating || !imagePrompt.trim() || !imageGenerationReady}
          className={imageGenerating ? 'ai-working' : undefined}
        >
          {imageGenerating ? 'Generazione...' : 'Genera In-App'}
        </button>
        <button type="button" onClick={() => void onAddImage()}>
          Associa Immagine
        </button>
      </div>
      {!imageGenerationReady ? (
        <p className="muted">
          Genera In-App non disponibile: manca {missingImageGenerationRequirements.join(', ')}.
        </p>
      ) : null}
      <div className="asset-list">
        {images.length === 0 ? <p className="muted">Nessuna immagine associata.</p> : null}
        {images.map((image) => (
          <div key={image.id} className="asset-item">
            <div className="asset-item-main">
              <div className="asset-preview">
                {previewErrors.includes(image.id) || !image.filePath.trim() ? (
                  <div className="asset-preview-fallback">Anteprima non disponibile</div>
                ) : !imagePreviewSources[image.id] ? (
                  <div className="asset-preview-fallback">Caricamento anteprima...</div>
                ) : (
                  <img
                    src={imagePreviewSources[image.id]}
                    alt={`Anteprima ${image.imageType}`}
                    onError={() => onPreviewError(image.id)}
                  />
                )}
              </div>
              <div className="asset-item-content">
                <p>
                  <strong>{image.imageType}</strong>
                </p>
                <p className="muted">{image.filePath}</p>
              </div>
            </div>
            <div className="asset-item-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() => onViewImage(image)}
                disabled={!imagePreviewSources[image.id]}
              >
                Vedi
              </button>
              <button type="button" onClick={() => void onDeleteImage(image.id)}>
                Elimina
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ImageViewerModal({
  viewerImage,
  onClose,
}: ImageViewerModalProps): ReactElement | null {
  if (!viewerImage) {
    return null;
  }

  return (
    <div className="modal-overlay image-viewer-overlay" onClick={onClose}>
      <div className="modal-card image-viewer-modal" onClick={(event) => event.stopPropagation()}>
        <h3>{viewerImage.label}</h3>
        <img src={viewerImage.src} alt={viewerImage.label} className="image-viewer-full" />
        <div className="row-buttons">
          <button type="button" onClick={onClose}>
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
