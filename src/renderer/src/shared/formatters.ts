export function parseTime(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function formatDateTime(value: string | null | undefined): string {
  const timestamp = parseTime(value);
  if (!timestamp) {
    return '-';
  }

  return new Intl.DateTimeFormat('it-IT', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(timestamp));
}

export function formatDate(value: string | Date | null | undefined): string {
  const timestamp = value instanceof Date ? value.getTime() : parseTime(value);
  if (!timestamp) {
    return '-';
  }

  return new Intl.DateTimeFormat('it-IT', {
    dateStyle: 'medium',
  }).format(new Date(timestamp));
}

export function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '-';
  }

  return new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 }).format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '-';
  }

  return `${new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 }).format(value)}%`;
}
