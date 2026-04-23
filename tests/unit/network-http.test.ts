import { describe, expect, it } from 'vitest';
import { __testing } from '../../src/main/network/http';

describe('network http helpers', () => {
  it('rewrites self-signed certificate failures into actionable messages', () => {
    const error = new TypeError('fetch failed', {
      cause: Object.assign(new Error('self signed certificate in certificate chain'), {
        code: 'SELF_SIGNED_CERT_IN_CHAIN',
      }),
    });

    const normalized = __testing.toExternalRequestError('OpenAI API', error);
    expect(normalized.message).toContain('certificato TLS non attendibile');
    expect(normalized.message).toContain('OpenAI API');
  });

  it('preserves non-TLS network errors', () => {
    const original = new Error('socket hang up');
    const normalized = __testing.toExternalRequestError('OpenAI API', original);

    expect(normalized).toBe(original);
  });
});
