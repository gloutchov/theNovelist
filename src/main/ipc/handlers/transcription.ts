import { randomUUID } from 'node:crypto';
import type { IpcMain, WebContents } from 'electron';
import { z } from 'zod';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import { APP_CONFIG } from '../../config/app-config';
import type { ProjectSessionManager } from '../../projects/session';
import { resolveCodexRuntime } from '../../services/codex-runtime';
import { getStoryContext } from '../../services/project-context';
import { TranscriptionSession } from '../../transcription/session';

const sessionRequest = z.object({ sessionId: z.string().uuid() });
const appendRequest = sessionRequest.extend({
  audio: z.string().max(Math.ceil((APP_CONFIG.transcription.maxChunkBytes * 4) / 3) + 4),
});

interface ActiveSession {
  projectId: string;
  session: TranscriptionSession;
  sender: WebContents;
  onDestroyed: () => void;
}

export function registerTranscriptionIpcHandlers(
  ipcMain: IpcMain,
  sessionManager: ProjectSessionManager,
): void {
  const active = new Map<number, ActiveSession>();

  function clear(senderId: number): void {
    const current = active.get(senderId);
    if (!current) return;
    current.session.cancel();
    if (!current.sender.isDestroyed())
      current.sender.removeListener('destroyed', current.onDestroyed);
    active.delete(senderId);
  }

  function requireSession(sender: WebContents, sessionId: string): TranscriptionSession {
    const current = active.get(sender.id);
    if (!current || current.session.id !== sessionId)
      throw new Error('transcription_session_not_found');
    let projectId: string;
    try {
      projectId = sessionManager.getCurrentProjectId();
    } catch {
      clear(sender.id);
      throw new Error('transcription_project_closed');
    }
    if (projectId !== current.projectId) {
      clear(sender.id);
      throw new Error('transcription_project_changed');
    }
    const settings = sessionManager.getRepository().getOrCreateCodexSettings(projectId);
    if (
      !settings.transcriptionEnabled ||
      (settings.transcriptionProvider !== 'whisper_local' &&
        (!settings.enabled || !settings.allowApiCalls || !settings.transcriptionAllowRemoteAudio))
    ) {
      clear(sender.id);
      throw new Error('transcription_consent_required');
    }
    return current.session;
  }

  ipcMain.handle(IPC_CHANNELS.transcriptionStart, async (event) => {
    if (active.has(event.sender.id)) throw new Error('transcription_already_active');
    const { repository, projectId } = getStoryContext(sessionManager);
    const settings = repository.getOrCreateCodexSettings(projectId);
    if (
      !settings.transcriptionEnabled ||
      (settings.transcriptionProvider !== 'whisper_local' &&
        (!settings.enabled || !settings.allowApiCalls || !settings.transcriptionAllowRemoteAudio))
    ) {
      throw new Error('transcription_consent_required');
    }
    let apiKey: string | null = null;
    if (settings.transcriptionProvider !== 'whisper_local') {
      try {
        apiKey =
          (await resolveCodexRuntime(repository, projectId)).runtimeApiKey?.trim() ||
          process.env['OPENAI_API_KEY']?.trim() ||
          null;
      } catch {
        if (settings.transcriptionFallbackProvider !== 'whisper_local')
          throw new Error('transcription_connection_failed');
      }
    }

    const sessionId = randomUUID();
    const sender = event.sender;
    const session = new TranscriptionSession(
      sessionId,
      {
        provider: settings.transcriptionProvider,
        fallbackProvider: settings.transcriptionFallbackProvider,
        model: settings.transcriptionModel,
        language: settings.transcriptionLanguage,
        local: {
          executablePath: settings.transcriptionWhisperExecutablePath,
          modelPath: settings.transcriptionWhisperModelPath,
          language: settings.transcriptionLanguage,
        },
      },
      (update) => {
        if (!sender.isDestroyed()) sender.send(IPC_CHANNELS.transcriptionEvent, update);
        if (update.type === 'final' || update.type === 'error') clear(sender.id);
      },
    );
    const onDestroyed = () => clear(sender.id);
    active.set(sender.id, { projectId, session, sender, onDestroyed });
    sender.once('destroyed', onDestroyed);
    try {
      await session.start(apiKey);
      return { sessionId, provider: session.activeProvider, usedFallback: session.usedFallback };
    } catch (caught) {
      clear(sender.id);
      if (
        caught instanceof Error &&
        [
          'transcription_model_unavailable',
          'transcription_local_unavailable',
          'transcription_api_key_required',
          'transcription_cancelled',
        ].includes(caught.message)
      ) {
        throw caught;
      }
      throw new Error('transcription_connection_failed');
    }
  });

  ipcMain.handle(IPC_CHANNELS.transcriptionAppend, (event, payload: unknown) => {
    const request = appendRequest.parse(payload);
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(request.audio)) {
      throw new Error('transcription_invalid_audio');
    }
    const session = requireSession(event.sender, request.sessionId);
    session.append(Buffer.from(request.audio, 'base64'));
    return { ok: true };
  });

  ipcMain.handle(IPC_CHANNELS.transcriptionStop, (event, payload: unknown) => {
    const { sessionId } = sessionRequest.parse(payload);
    requireSession(event.sender, sessionId).stop();
    return { ok: true };
  });

  ipcMain.handle(IPC_CHANNELS.transcriptionCancel, (event, payload: unknown) => {
    const { sessionId } = sessionRequest.parse(payload);
    const current = active.get(event.sender.id);
    if (current?.session.id === sessionId) clear(event.sender.id);
    return { ok: true };
  });
}
