import { describe, expect, it } from 'vitest';
import { IPC_CHANNEL_GROUPS, ALL_IPC_CHANNELS_BY_DOMAIN } from '../../src/main/ipc/channel-groups';
import { getRegisteredIpcChannelNames } from '../../src/main/ipc/registry';
import { IPC_CHANNELS } from '../../src/shared/ipc-channels';

describe('IPC channel groups', () => {
  it('covers every shared IPC channel exactly once', () => {
    const groupedChannels = ALL_IPC_CHANNELS_BY_DOMAIN;
    const uniqueGroupedChannels = new Set(groupedChannels);

    expect(uniqueGroupedChannels.size).toBe(groupedChannels.length);
    expect(uniqueGroupedChannels).toEqual(new Set(Object.values(IPC_CHANNELS)));
  });

  it('keeps channels grouped by main-process domain', () => {
    expect(IPC_CHANNEL_GROUPS.project).toContain(IPC_CHANNELS.projectCreate);
    expect(IPC_CHANNEL_GROUPS.chapter).toContain(IPC_CHANNELS.chapterSaveDocument);
    expect(IPC_CHANNEL_GROUPS.character).toContain(IPC_CHANNELS.characterCreateImage);
    expect(IPC_CHANNEL_GROUPS.location).toContain(IPC_CHANNELS.locationCreateImage);
    expect(IPC_CHANNEL_GROUPS.codex).toContain(IPC_CHANNELS.codexChat);
    expect(IPC_CHANNEL_GROUPS.wiki).toContain(IPC_CHANNELS.wikiSearch);
  });

  it('uses the grouped manifest for handler cleanup', () => {
    expect(getRegisteredIpcChannelNames()).toEqual(ALL_IPC_CHANNELS_BY_DOMAIN);
  });
});
