export interface ClipboardWriter {
  writeText: (text: string) => Promise<void>;
}

export const writeClipboardText = async (
  text: string,
  clipboard: ClipboardWriter | undefined = globalThis.navigator?.clipboard,
): Promise<void> => {
  if (!clipboard || typeof clipboard.writeText !== 'function') {
    throw new Error('Clipboard API unavailable');
  }

  await clipboard.writeText(text);
};
