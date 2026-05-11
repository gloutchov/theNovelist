import { describe, expect, it } from 'vitest';
import { toImageSource } from '../../src/renderer/src/image-path';

describe('toImageSource', () => {
  it('rejects remote and direct file URL image sources', () => {
    expect(toImageSource('https://example.com/image.png')).toBe('');
    expect(toImageSource('http://example.com/image.png')).toBe('');
    expect(toImageSource('file:///tmp/image.png')).toBe('');
  });

  it('keeps runtime data and blob image sources', () => {
    expect(toImageSource('data:image/png;base64,abc')).toBe('data:image/png;base64,abc');
    expect(toImageSource('blob:http://localhost/id')).toBe('blob:http://localhost/id');
  });
});
