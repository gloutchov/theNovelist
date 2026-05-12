import { renderReadingDocument } from './reading-document';
import type { ReadingViewState } from './reading-view';

interface ReadingViewOverlayProps {
  readingView: ReadingViewState;
  onClose: () => void;
}

export function ReadingViewOverlay({ readingView, onClose }: ReadingViewOverlayProps) {
  return (
    <section className="reading-view-overlay" role="dialog" aria-modal="true">
      <header className="reading-view-header">
        <div>
          <p>{readingView.subtitle}</p>
          <h1>{readingView.title}</h1>
        </div>
        <button type="button" className="button-secondary" onClick={onClose}>
          Chiudi
        </button>
      </header>
      <div className="reading-view-scroll">
        <div className="reading-view-document">
          {readingView.chapters.map((chapter) => (
            <article key={chapter.id} className="reading-view-chapter">
              {readingView.chapters.length > 1 ? <h2>{chapter.title}</h2> : null}
              <div className="reading-view-content">{renderReadingDocument(chapter.document)}</div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
