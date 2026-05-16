import type { ReactElement } from 'react';
import type { Translate } from '../../i18n';

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
  t: Translate;
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
  t: Translate;
}

interface ImageViewerModalProps {
  viewerImage: { src: string; label: string } | null;
  onClose: () => void;
  t: Translate;
}

const IMAGE_SIZE_OPTIONS: { value: EntityImageSize; labelKey: string }[] = [
  { value: '1024x1024', labelKey: 'entity.image.sizeSquare' },
  { value: '1536x1024', labelKey: 'entity.image.sizeHorizontal' },
  { value: '1024x1536', labelKey: 'entity.image.sizeVertical' },
];

export function LinkedChaptersPanel<TChapter extends { id: string }>({
  chapters,
  formatChapterLabel,
  t,
}: LinkedChaptersPanelProps<TChapter>): ReactElement {
  return (
    <div className="panel panel-subsection">
      <h4>{t('entity.common.linkedChapters')}</h4>
      <div className="chapter-links-list">
        {chapters.length === 0 ? (
          <p className="muted">{t('entity.common.noLinkedChapters')}</p>
        ) : null}
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
  t,
}: EntityImageSectionProps<TImage>): ReactElement {
  return (
    <div className="panel panel-subsection">
      <h4>{t('entity.image.sectionTitle')}</h4>
      <div className="grid-two">
        <label>
          {t('entity.image.type')}
          <select value={imageType} onChange={(event) => onImageTypeChange(event.target.value)}>
            {imageTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('entity.image.path')}
          <div className="input-with-button">
            <input value={imagePath} onChange={(event) => onImagePathChange(event.target.value)} />
            <button
              type="button"
              className="button-secondary"
              onClick={() => void onSelectImagePath()}
            >
              {t('entity.image.browse')}
            </button>
          </div>
        </label>
        <label>
          {t('entity.image.size')}
          <select
            value={imageSize}
            onChange={(event) => onImageSizeChange(event.target.value as EntityImageSize)}
          >
            {IMAGE_SIZE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        {t('entity.image.prompt')}
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
          {t('entity.image.promptFrom', { assistant: aiAssistantLabel })}
        </button>
        <button
          type="button"
          onClick={() => void onGenerateImage()}
          disabled={imageGenerating || !imagePrompt.trim() || !imageGenerationReady}
          className={imageGenerating ? 'ai-working' : undefined}
        >
          {imageGenerating ? t('entity.image.generating') : t('entity.image.generate')}
        </button>
        <button type="button" onClick={() => void onAddImage()}>
          {t('entity.image.add')}
        </button>
      </div>
      {!imageGenerationReady ? (
        <p className="muted">
          {t('entity.image.missingRequirements', {
            requirements: missingImageGenerationRequirements.join(', '),
          })}
        </p>
      ) : null}
      <div className="asset-list">
        {images.length === 0 ? <p className="muted">{t('entity.image.noImages')}</p> : null}
        {images.map((image) => (
          <div key={image.id} className="asset-item">
            <div className="asset-item-main">
              <div className="asset-preview">
                {previewErrors.includes(image.id) || !image.filePath.trim() ? (
                  <div className="asset-preview-fallback">
                    {t('entity.image.previewUnavailable')}
                  </div>
                ) : !imagePreviewSources[image.id] ? (
                  <div className="asset-preview-fallback">{t('entity.image.previewLoading')}</div>
                ) : (
                  <img
                    src={imagePreviewSources[image.id]}
                    alt={t('entity.image.previewAlt', { type: image.imageType })}
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
                {t('entity.image.view')}
              </button>
              <button type="button" onClick={() => void onDeleteImage(image.id)}>
                {t('common.delete')}
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
  t,
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
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
