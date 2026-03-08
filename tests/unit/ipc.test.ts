import { describe, expect, it } from 'vitest';
import { buildPingResponse } from '../../src/main/ipc';

describe('buildPingResponse', () => {
  it('returns a formatted pong message', () => {
    const response = buildPingResponse({ message: 'ciao' });

    expect(response.message).toBe('Pong: ciao');
    expect(new Date(response.timestamp).toString()).not.toBe('Invalid Date');
  });
});
