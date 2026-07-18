import { describe, expect, it } from 'vitest';
import { previewChatText } from './chat';

describe('previewChatText', () => {
  it('collapses whitespace and truncates long previews', () => {
    expect(previewChatText('  hello   world  ')).toBe('hello world');
    expect(previewChatText('a'.repeat(100), 20)).toBe(`${'a'.repeat(19)}…`);
  });
});
