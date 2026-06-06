import { BrowserWindow, dialog } from 'electron';
import { translateMain } from '../i18n';
import type { ProjectSessionManager } from '../projects/session';

export type ActiveImportCloseTarget = 'project' | 'app';

export function confirmActiveExternalSourceImportClose(params: {
  sessionManager: ProjectSessionManager;
  browserWindow?: BrowserWindow | null;
  target: ActiveImportCloseTarget;
}): boolean {
  if (!params.sessionManager.hasActiveExternalSourceImport()) {
    return true;
  }

  const options: Electron.MessageBoxSyncOptions = {
    type: 'warning',
    buttons: [
      translateMain('dialog.activeImport.buttons.cancel'),
      translateMain('dialog.activeImport.buttons.close'),
    ],
    defaultId: 0,
    cancelId: 0,
    title: translateMain('dialog.activeImport.title'),
    message: translateMain(
      params.target === 'project'
        ? 'dialog.activeImport.message.project'
        : 'dialog.activeImport.message.app',
    ),
  };

  const choice =
    params.browserWindow && !params.browserWindow.isDestroyed()
      ? dialog.showMessageBoxSync(params.browserWindow, options)
      : dialog.showMessageBoxSync(options);

  return choice === 1;
}
