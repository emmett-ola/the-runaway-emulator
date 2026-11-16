import { expect, afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { IDBFactory } from 'fake-indexeddb';
import { webcrypto } from 'node:crypto';
import { initializeStorage, resetStorage } from '../lib/storage';

expect.extend(matchers);

beforeEach(async () => {
  await resetStorage();
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new IDBFactory() });
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });
  await initializeStorage();
});
afterEach(async () => {
  cleanup();
  await resetStorage();
});
