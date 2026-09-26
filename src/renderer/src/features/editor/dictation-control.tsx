import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import type { SelectionBookmark } from '@tiptap/pm/state';
import type { Media } from './dictation-audio';
import { captureMicrophone } from './dictation-audio';
import type { Translate } from '../../i18n';

type Phase = 'idle' | 'permission' | 'connecting' | 'recording' | 'transcribing' | 'error';

function errorKey(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : '';
  if (message.includes('consent')) return 'editor.dictation.consentRequired';
  if (message.includes('api_key')) return 'editor.dictation.keyRequired';
  if (message.includes('model_unavailable')) return 'editor.dictation.modelUnavailable';
  if (
    name === 'NotAllowedError' ||
    name === 'SecurityError' ||
    message.includes('NotAllowedError') ||
    message.includes('Permission')
  )
    return 'editor.dictation.permissionDenied';
  if (message.includes('limit')) return 'editor.dictation.limitReached';
  if (message.includes('timeout')) return 'editor.dictation.timeout';
  return 'editor.dictation.error';
}

export function DictationControl({ editor, t }: { editor: Editor | null; t: Translate }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const sessionId = useRef<string | null>(null);
  const media = useRef<Media | null>(null);
  const bookmark = useRef<SelectionBookmark | null>(null);
  const generation = useRef(0);
  const pendingAudio = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    const off = window.novelistApi.onTranscriptionEvent((event) => {
      if (event.sessionId !== sessionId.current) return;
      if (event.type === 'partial') {
        setPreview(event.text);
      } else if (event.type === 'final') {
        sessionId.current = null;
        setPreview('');
        setPhase('idle');
        const text = event.text.trim();
        if (!text || !editor || editor.isDestroyed || !bookmark.current) {
          if (!text) setError(t('editor.dictation.noSpeech'));
          return;
        }
        const selection = bookmark.current.resolve(editor.state.doc);
        editor
          .chain()
          .focus()
          .insertContentAt({ from: selection.from, to: selection.to }, text)
          .run();
        bookmark.current = null;
      } else if (event.type === 'error') {
        sessionId.current = null;
        media.current?.stop();
        media.current = null;
        bookmark.current = null;
        setPhase('error');
        setError(
          t(
            event.code === 'model_unavailable'
              ? 'editor.dictation.modelUnavailable'
              : event.code === 'limit'
                ? 'editor.dictation.limitReached'
                : event.code === 'timeout'
                  ? 'editor.dictation.timeout'
                  : 'editor.dictation.error',
          ),
        );
      }
    });
    return off;
  }, [editor, t]);

  useEffect(() => {
    if (!editor) return;
    const mapBookmark = ({
      transaction,
    }: {
      transaction: { mapping: Parameters<SelectionBookmark['map']>[0] };
    }) => {
      if (bookmark.current) bookmark.current = bookmark.current.map(transaction.mapping);
    };
    editor.on('transaction', mapBookmark);
    return () => {
      editor.off('transaction', mapBookmark);
    };
  }, [editor]);

  useEffect(() => {
    return () => {
      generation.current += 1;
      media.current?.stop();
      if (sessionId.current)
        void window.novelistApi.transcriptionCancel({ sessionId: sessionId.current });
      sessionId.current = null;
    };
  }, []);

  async function start(): Promise<void> {
    if (!editor || (phase !== 'idle' && phase !== 'error')) return;
    const currentGeneration = ++generation.current;
    setError('');
    setPreview('');
    try {
      const settings = await window.novelistApi.codexGetSettings();
      if (
        !settings.enabled ||
        !settings.allowApiCalls ||
        !settings.transcriptionEnabled ||
        !settings.transcriptionAllowRemoteAudio
      ) {
        throw new Error('transcription_consent_required');
      }
      if (!settings.hasRuntimeApiKey) throw new Error('transcription_api_key_required');
      if (currentGeneration !== generation.current) return;
      bookmark.current = editor.state.selection.getBookmark();
      setPhase('permission');
      const audio = await captureMicrophone((chunk) => {
        if (!sessionId.current) return;
        const id = sessionId.current;
        pendingAudio.current = pendingAudio.current
          .then(() => window.novelistApi.transcriptionAppend({ sessionId: id, audio: chunk }))
          .catch((caught) => {
            if (sessionId.current !== id) return;
            setError(t(errorKey(caught)));
            media.current?.stop();
            media.current = null;
            setPhase('error');
            void window.novelistApi.transcriptionCancel({ sessionId: id });
            sessionId.current = null;
          });
      });
      if (currentGeneration !== generation.current) {
        audio.stop();
        return;
      }
      media.current = audio;
      setPhase('connecting');
      const started = await window.novelistApi.transcriptionStart();
      if (currentGeneration !== generation.current) {
        audio.stop();
        void window.novelistApi.transcriptionCancel(started);
        return;
      }
      sessionId.current = started.sessionId;
      setPhase('recording');
    } catch (caught) {
      if (currentGeneration !== generation.current) return;
      media.current?.stop();
      media.current = null;
      bookmark.current = null;
      setPhase('error');
      setError(t(errorKey(caught)));
    }
  }

  async function stop(): Promise<void> {
    if (phase !== 'recording' || !sessionId.current) return;
    media.current?.stop();
    media.current = null;
    setPhase('transcribing');
    try {
      await pendingAudio.current;
      if (sessionId.current)
        await window.novelistApi.transcriptionStop({ sessionId: sessionId.current });
    } catch (caught) {
      setError(t(errorKey(caught)));
      setPhase('error');
    }
  }

  function cancel(): void {
    generation.current += 1;
    media.current?.stop();
    media.current = null;
    bookmark.current = null;
    if (sessionId.current)
      void window.novelistApi.transcriptionCancel({ sessionId: sessionId.current });
    sessionId.current = null;
    setPhase('idle');
    setPreview('');
    setError('');
  }

  return (
    <div className="dictation-control" role="group" aria-label={t('editor.dictation.title')}>
      {phase === 'idle' || phase === 'error' ? (
        <button
          type="button"
          className="button-secondary"
          onClick={() => void start()}
          disabled={!editor}
        >
          {t('editor.dictation.start')}
        </button>
      ) : null}
      {phase === 'recording' ? (
        <button type="button" onClick={() => void stop()}>
          {t('editor.dictation.stop')}
        </button>
      ) : null}
      {phase !== 'idle' && phase !== 'error' ? (
        <button type="button" className="button-secondary" onClick={cancel}>
          {t('common.cancel')}
        </button>
      ) : null}
      {phase === 'permission' ||
      phase === 'connecting' ||
      phase === 'recording' ||
      phase === 'transcribing' ? (
        <span className="muted" role="status">
          {t(`editor.dictation.${phase}`)}
        </span>
      ) : null}
      {preview ? (
        <span className="dictation-preview" aria-live="polite">
          {preview}
        </span>
      ) : null}
      {error ? (
        <span className="error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
