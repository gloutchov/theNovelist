import type { ProjectSessionManager } from '../projects/session';

type Repository = ReturnType<ProjectSessionManager['getRepository']>;

export type ResolveImageApiRuntime = (
  repository: Repository,
  projectId: string,
) => Promise<{ apiKey: string; model: string }>;
