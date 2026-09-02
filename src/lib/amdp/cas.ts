import type { CasObject } from './types.ts';

export type CasStore = {
  get(sha256: string): CasObject | undefined;
  has(sha256: string): boolean;
  put(object: CasObject): void;
  delete(sha256: string): boolean;
  entries(): CasObject[];
  size(): number;
};

export function createMemoryCas(): CasStore {
  const objects = new Map<string, CasObject>();
  return {
    get(sha256) {
      return objects.get(sha256);
    },
    has(sha256) {
      return objects.has(sha256);
    },
    put(object) {
      objects.set(object.sha256, object);
    },
    delete(sha256) {
      return objects.delete(sha256);
    },
    entries() {
      return [...objects.values()];
    },
    size() {
      return objects.size;
    },
  };
}
