import { createElement, useState } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  return {
    ...actual,
    ReactFlow: () => null,
    Background: () => null,
    Controls: () => null,
    MiniMap: () => null,
  };
});

vi.mock('../../src/renderer/src/ChapterEditor', () => ({
  default: () => null,
}));

import SceneBoard from '../../src/renderer/src/SceneBoard';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SceneBoard parent updates', () => {
  it('does not update the parent while the board is rendering', () => {
    const errors: unknown[][] = [];
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      errors.push(args);
    });
    const parentUpdates: string[] = [];

    function Parent(): React.ReactElement {
      const [, setDirty] = useState(false);
      return createElement(SceneBoard, {
        autosaveSettings: null,
        currentProject: null,
        onDirtyChange: (dirty: boolean) => {
          parentUpdates.push(`dirty:${dirty}`);
          setDirty(dirty);
        },
        onRegisterFlush: () => {
          parentUpdates.push('flush');
        },
        onStatus: () => undefined,
        onWikiSync: async () => undefined,
        statusMessage: '',
        t: (key: string) => key,
      });
    }

    expect(() => renderToString(createElement(Parent))).not.toThrow();
    expect(parentUpdates).toEqual([]);
    expect(
      errors.some((args) => args.join(' ').includes('Cannot update a component while rendering')),
    ).toBe(false);
  });
});
