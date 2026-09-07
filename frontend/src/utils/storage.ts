type StorageParser<T> = (rawValue: string) => T | undefined;
type JsonValidator<T> = (value: unknown) => value is T;

export function readStorageValue<T>(
  key: string,
  parse: StorageParser<T>,
  fallback: () => T,
): T {
  try {
    const rawValue = localStorage.getItem(key);
    if (rawValue === null) return fallback();

    return parse(rawValue) ?? fallback();
  } catch {
    return fallback();
  }
}

export function readJsonStorage<T>(
  key: string,
  isValid: JsonValidator<T>,
  fallback: () => T,
): T {
  return readStorageValue(
    key,
    (rawValue) => {
      const parsed: unknown = JSON.parse(rawValue);
      return isValid(parsed) ? parsed : undefined;
    },
    fallback,
  );
}

export function writeStorageValue(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function writeJsonStorage(key: string, value: unknown): boolean {
  try {
    return writeStorageValue(key, JSON.stringify(value));
  } catch {
    return false;
  }
}
