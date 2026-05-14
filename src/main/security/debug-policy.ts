export const ENABLE_DEVTOOLS_ENV = 'NOVELIST_ENABLE_DEVTOOLS';

interface DebugPolicyEnv {
  [key: string]: string | undefined;
}

interface KeyboardInput {
  key?: string;
  code?: string;
  control?: boolean;
  meta?: boolean;
  shift?: boolean;
}

export function isDevToolsEnabled(input: { env: DebugPolicyEnv; rendererUrl?: string }): boolean {
  const flag = input.env[ENABLE_DEVTOOLS_ENV]?.trim().toLowerCase();
  return Boolean(input.rendererUrl) || flag === '1' || flag === 'true' || flag === 'yes';
}

export function isBlockedProductionShortcut(input: KeyboardInput): boolean {
  const key = (input.key ?? '').toLowerCase();
  const code = (input.code ?? '').toLowerCase();
  const commandOrControl = Boolean(input.control || input.meta);

  if (key === 'f5' || code === 'f5' || key === 'f12' || code === 'f12') {
    return true;
  }

  if (commandOrControl && key === 'r') {
    return true;
  }

  if (commandOrControl && input.shift && ['i', 'j', 'c'].includes(key)) {
    return true;
  }

  return false;
}
