const TLS_ERROR_CODES = new Set([
  'SELF_SIGNED_CERT_IN_CHAIN',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'CERT_HAS_EXPIRED',
]);

type ElectronNetModule = typeof import('electron');

function getErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return '';
  }

  const code = (error as { code?: unknown }).code;
  if (typeof code === 'string' && code.trim()) {
    return code.trim().toUpperCase();
  }

  const cause = (error as { cause?: unknown }).cause;
  if (cause && typeof cause === 'object') {
    const nestedCode = (cause as { code?: unknown }).code;
    if (typeof nestedCode === 'string' && nestedCode.trim()) {
      return nestedCode.trim().toUpperCase();
    }
  }

  return '';
}

function getErrorMessages(error: unknown): string[] {
  if (!error || typeof error !== 'object') {
    return [];
  }

  const messages: string[] = [];
  const directMessage = (error as { message?: unknown }).message;
  if (typeof directMessage === 'string' && directMessage.trim()) {
    messages.push(directMessage.trim());
  }

  const cause = (error as { cause?: unknown }).cause;
  if (cause && typeof cause === 'object') {
    const nestedMessage = (cause as { message?: unknown }).message;
    if (typeof nestedMessage === 'string' && nestedMessage.trim()) {
      messages.push(nestedMessage.trim());
    }
  }

  return messages;
}

async function resolveElectronNetFetch(): Promise<typeof fetch | null> {
  try {
    const electronModule = (await import('electron')) as ElectronNetModule;
    const netFetch = electronModule.net?.fetch;
    if (typeof netFetch !== 'function') {
      return null;
    }

    return ((input: string | URL | Request, init?: RequestInit) => {
      if (input instanceof URL) {
        return netFetch(input.toString(), init as Parameters<typeof netFetch>[1]) as Promise<Response>;
      }
      return netFetch(input as Parameters<typeof netFetch>[0], init as Parameters<typeof netFetch>[1]) as Promise<Response>;
    }) as typeof fetch;
  } catch {
    return null;
  }
}

export async function appFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const electronFetch = await resolveElectronNetFetch();
  if (electronFetch) {
    return electronFetch(input, init);
  }

  return fetch(input, init);
}

export function toExternalRequestError(serviceLabel: string, error: unknown): Error {
  const errorCode = getErrorCode(error);
  const messages = getErrorMessages(error);
  const lowerCaseMessages = messages.map((message) => message.toLowerCase());
  const isTlsError =
    TLS_ERROR_CODES.has(errorCode) ||
    lowerCaseMessages.some(
      (message) =>
        message.includes('self signed certificate') ||
        message.includes('certificate chain') ||
        message.includes('unable to verify the first certificate'),
    );

  if (isTlsError) {
    return new Error(
      `${serviceLabel}: certificato TLS non attendibile. Verifica proxy/antivirus aziendale oppure importa la CA nel sistema operativo.`,
    );
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(`${serviceLabel}: errore di rete`);
}

export const __testing = {
  toExternalRequestError,
};
