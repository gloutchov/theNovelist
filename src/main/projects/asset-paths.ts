import { existsSync } from 'node:fs';
import path from 'node:path';

const URL_PATH_PATTERN = /^(https?:|data:|file:)/i;
const WINDOWS_DRIVE_PATH_PATTERN = /^[A-Za-z]:[\\/]/;
const WINDOWS_UNC_PATH_PATTERN = /^\\\\/;

function normalizeRelativePath(filePath: string): string {
  return filePath.trim().replace(/[\\/]+/g, path.sep);
}

function getRelativePathFromAssets(filePath: string): string | null {
  const normalizedPath = path.normalize(filePath);
  const parts = normalizedPath.split(path.sep);
  const assetsIndex = parts.lastIndexOf('assets');
  if (assetsIndex < 0 || assetsIndex === parts.length - 1) {
    return null;
  }

  return parts.slice(assetsIndex + 1).join(path.sep);
}

export function isAbsoluteLocalPath(filePath: string): boolean {
  const trimmed = filePath.trim();
  return path.isAbsolute(trimmed) || WINDOWS_DRIVE_PATH_PATTERN.test(trimmed) || WINDOWS_UNC_PATH_PATTERN.test(trimmed);
}

export function toProjectStoredFilePath(projectRootPath: string, filePath: string): string {
  const trimmed = filePath.trim();
  if (!trimmed || URL_PATH_PATTERN.test(trimmed) || !isAbsoluteLocalPath(trimmed)) {
    return trimmed;
  }

  const resolvedProjectRootPath = path.resolve(projectRootPath.trim());
  const resolvedFilePath = path.resolve(trimmed);
  const relativeFilePath = path.relative(resolvedProjectRootPath, resolvedFilePath);

  if (!relativeFilePath || relativeFilePath === '..' || relativeFilePath.startsWith(`..${path.sep}`)) {
    return resolvedFilePath;
  }

  return relativeFilePath;
}

export function resolveProjectStoredFilePath(input: {
  projectRootPath: string;
  assetsPath: string;
  filePath: string;
}): string {
  const trimmed = input.filePath.trim();
  if (!trimmed || URL_PATH_PATTERN.test(trimmed)) {
    return trimmed;
  }

  if (isAbsoluteLocalPath(trimmed)) {
    return path.normalize(trimmed);
  }

  const normalizedRelativePath = normalizeRelativePath(trimmed);
  const resolvedProjectRootPath = path.resolve(input.projectRootPath.trim());
  const resolvedAssetsPath = path.resolve(input.assetsPath.trim());
  const rootCandidate = path.resolve(resolvedProjectRootPath, normalizedRelativePath);
  const assetsCandidate = path.resolve(resolvedAssetsPath, normalizedRelativePath);

  const candidatePaths =
    normalizedRelativePath === 'assets' || normalizedRelativePath.startsWith(`assets${path.sep}`)
      ? [rootCandidate, assetsCandidate]
      : normalizedRelativePath === 'img' ||
          normalizedRelativePath.startsWith(`img${path.sep}`) ||
          normalizedRelativePath === 'generated-images' ||
          normalizedRelativePath.startsWith(`generated-images${path.sep}`)
        ? [assetsCandidate, rootCandidate]
        : [rootCandidate, assetsCandidate];

  for (const candidatePath of candidatePaths) {
    if (existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  return candidatePaths[0] ?? rootCandidate;
}

export function repairProjectStoredFilePath(input: {
  projectRootPath: string;
  assetsPath: string;
  filePath: string;
}): string {
  const trimmed = input.filePath.trim();
  if (!trimmed || URL_PATH_PATTERN.test(trimmed)) {
    return trimmed;
  }

  const resolvedProjectRootPath = path.resolve(input.projectRootPath.trim());
  const resolvedAssetsPath = path.resolve(input.assetsPath.trim());

  if (!isAbsoluteLocalPath(trimmed)) {
    const resolvedPath = resolveProjectStoredFilePath(input);
    return toProjectStoredFilePath(resolvedProjectRootPath, resolvedPath);
  }

  const normalizedAbsolutePath = path.resolve(trimmed);
  const projectStoredPath = toProjectStoredFilePath(resolvedProjectRootPath, normalizedAbsolutePath);
  if (!isAbsoluteLocalPath(projectStoredPath)) {
    return projectStoredPath;
  }

  const relativePathFromAssets = getRelativePathFromAssets(normalizedAbsolutePath);
  if (!relativePathFromAssets) {
    return normalizedAbsolutePath;
  }

  const repairedAbsolutePath = path.join(resolvedAssetsPath, relativePathFromAssets);
  if (!existsSync(normalizedAbsolutePath) || existsSync(repairedAbsolutePath)) {
    return toProjectStoredFilePath(resolvedProjectRootPath, repairedAbsolutePath);
  }

  return normalizedAbsolutePath;
}
