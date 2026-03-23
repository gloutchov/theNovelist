export type StatusTone = 'success' | 'danger' | 'neutral';

export function getStatusTone(message: string): StatusTone {
  const normalized = message.trim().toLowerCase();

  if (!normalized) {
    return 'neutral';
  }

  if (
    normalized.includes('errore') ||
    normalized.includes('fallit') ||
    normalized.includes('eliminat') ||
    normalized.includes('cancell')
  ) {
    return 'danger';
  }

  if (normalized.includes('salvat')) {
    return 'success';
  }

  return 'neutral';
}
