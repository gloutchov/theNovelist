export function isSafeWikiRelativePath(relativePath: string): boolean {
  const normalized = relativePath.trim().replace(/\\/g, '/');
  if (!normalized || normalized.startsWith('/') || normalized.includes('\0')) {
    return false;
  }

  const parts = normalized.split('/');
  return parts.every((part) => part && part !== '.' && part !== '..');
}
