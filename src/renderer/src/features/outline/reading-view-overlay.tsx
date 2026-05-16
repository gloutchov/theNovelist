import { renderReadingDocument } from './reading-document';
import type { ReadingViewState } from './reading-view';
import type { Translate } from '../../i18n';

interface ReadingViewOverlayProps {
  readingView: ReadingViewState;
  onClose: () => void;
  t: Translate;
}

export function ReadingViewOverlay({ readingView, onClose, t }: ReadingViewOverlayProps) {
  return (
    <section className="reading-view-overlay" role="dialog" aria-modal="true">
      <header className="reading-view-header">
        <div>
          <p>{readingView.subtitle}</p>
          <h1>{readingView.title}</h1>
        </div>
        <button type="button" className="button-secondary" onClick={onClose}>
          {t('reading.close')}
        </button>
      </header>
      <div className="reading-view-scroll">
        <div className="reading-view-document">
          {readingView.chapters.map((chapter) => (
            <article key={chapter.id} className="reading-view-chapter">
              {readingView.chapters.length > 1 ? <h2>{chapter.title}</h2> : null}
              <div className="reading-view-content">
                {renderReadingDocument(chapter.document, t)}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
