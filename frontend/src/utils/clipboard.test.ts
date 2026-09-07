import { describe, expect, it, vi } from 'vitest';

import { writeClipboardText } from './clipboard';

describe('writeClipboardText', () => {
  it('writes the exact requested text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    await expect(writeClipboardText('citation text', { writeText })).resolves.toBeUndefined();
    expect(writeText).toHaveBeenCalledWith('citation text');
  });

  it('rejects when the Clipboard API is unavailable', async () => {
    await expect(writeClipboardText('citation text', undefined)).rejects.toThrow(
      'Clipboard API unavailable',
    );
  });

  it('propagates permission failures for the UI to report', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('Permission denied'));

    await expect(writeClipboardText('citation text', { writeText })).rejects.toThrow(
      'Permission denied',
    );
  });
});
