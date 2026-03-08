import type { NovelistApi } from '../../preload';

declare global {
  interface Window {
    novelistApi: NovelistApi;
  }
}

export {};
