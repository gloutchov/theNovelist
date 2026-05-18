import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import type { ProjectRecord } from '../project/project-session';
import type { OutlineChapter } from './outline-state';
import { buildOutlineChapterOrder } from './outline-state';
import { parseReadingDocument, type RichTextDocumentJson } from './reading-document';
import type { Translate } from '../../i18n';

type ChapterDocumentRecord = Awaited<ReturnType<(typeof window.novelistApi)['getChapterDocument']>>;

interface ReadingChapter {
  id: string;
  title: string;
  document: RichTextDocumentJson;
  wordCount: number;
}

export interface ReadingViewState {
  title: string;
  subtitle: string;
  chapters: ReadingChapter[];
}

interface ReadingViewStateOptions {
  currentProject: ProjectRecord | null;
  setError: Dispatch<SetStateAction<string | null>>;
  setStatus: Dispatch<SetStateAction<string>>;
  t: Translate;
}

export function useReadingViewState({
  currentProject,
  setError,
  setStatus,
  t,
}: ReadingViewStateOptions) {
  const [readingView, setReadingView] = useState<ReadingViewState | null>(null);
  const [readingViewLoading, setReadingViewLoading] = useState<boolean>(false);

  const openChapterReadingView = useCallback(
    async (chapter: OutlineChapter): Promise<void> => {
      if (!currentProject) {
        setStatus(t('dashboard.project.none'));
        return;
      }

      setReadingViewLoading(true);
      setError(null);

      try {
        const document = await window.novelistApi.getChapterDocument({
          chapterNodeId: chapter.node.id,
        });
        setReadingView({
          title: chapter.node.title,
          subtitle: currentProject.name,
          chapters: [
            {
              id: chapter.node.id,
              title: chapter.node.title,
              document: parseReadingDocument(document.contentJson),
              wordCount: document.wordCount,
            },
          ],
        });
        setStatus(t('reading.status.chapterOpened', { title: chapter.node.title }));
      } catch (caughtError) {
        const message =
          caughtError instanceof Error ? caughtError.message : t('common.unknownError');
        setError(message);
        setStatus(t('reading.status.chapterOpenError'));
      } finally {
        setReadingViewLoading(false);
      }
    },
    [currentProject, setError, setStatus, t],
  );

  const openFullDocumentReadingView = useCallback(async (): Promise<void> => {
    if (!currentProject) {
      setStatus(t('dashboard.project.none'));
      return;
    }

    setReadingViewLoading(true);
    setError(null);

    try {
      const state = await window.novelistApi.getStoryState();
      const { orderedChapters } = buildOutlineChapterOrder(state.nodes, state.edges);
      if (orderedChapters.length === 0) {
        setError(t('outline.empty'));
        setStatus(t('reading.status.fullDocumentUnavailable'));
        return;
      }

      const documentsByNodeId = new Map<string, ChapterDocumentRecord>(
        (
          await Promise.all(
            orderedChapters.map(async (chapter) => {
              const document = await window.novelistApi.getChapterDocument({
                chapterNodeId: chapter.id,
              });
              return [chapter.id, document] as const;
            }),
          )
        ).map(([chapterNodeId, document]) => [chapterNodeId, document]),
      );

      setReadingView({
        title: t('reading.fullDocumentTitle', { name: currentProject.name }),
        subtitle: `${orderedChapters.length} ${t('outline.summary.chapters')}`,
        chapters: orderedChapters.map((chapter) => {
          const document = documentsByNodeId.get(chapter.id);
          return {
            id: chapter.id,
            title: chapter.title,
            document: parseReadingDocument(document?.contentJson ?? ''),
            wordCount: document?.wordCount ?? 0,
          };
        }),
      });
      setStatus(t('reading.status.fullDocumentOpened'));
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : t('common.unknownError');
      setError(message);
      setStatus(t('reading.status.fullDocumentOpenError'));
    } finally {
      setReadingViewLoading(false);
    }
  }, [currentProject, setError, setStatus, t]);

  useEffect(() => {
    if (!readingView) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setReadingView(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [readingView]);

  return {
    openChapterReadingView,
    openFullDocumentReadingView,
    readingView,
    readingViewLoading,
    setReadingView,
  };
}
