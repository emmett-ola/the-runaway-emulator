import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RegisterSWOptions } from 'vite-plugin-pwa/types';
import { registerSW } from 'virtual:pwa-register';
import { initializePwa } from './pwa';

vi.mock('virtual:pwa-register', () => ({ registerSW: vi.fn() }));

let serviceWorker: EventTarget & { controller: ServiceWorker | null };
let reload: ReturnType<typeof vi.fn>;
let update: ReturnType<typeof vi.fn>;
let stop: (() => void) | undefined;
const controller = () => ({}) as ServiceWorker;
const options = () => vi.mocked(registerSW).mock.calls[0][0] as RegisterSWOptions;
const registered = () => options().onRegisteredSW?.('/sw.js', { update } as unknown as ServiceWorkerRegistration);
const changeController = () => {
  serviceWorker.controller = controller();
  serviceWorker.dispatchEvent(new Event('controllerchange'));
};

beforeEach(() => {
  // Leave IndexedDB's setImmediate/setTimeout work real for the shared storage hooks.
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  reload = vi.fn();
  update = vi.fn().mockResolvedValue(undefined);
  serviceWorker = Object.assign(new EventTarget(), { controller: controller() as ServiceWorker | null });
  vi.stubGlobal('window', { location: { reload }, setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval });
  vi.stubGlobal('navigator', { serviceWorker, onLine: true });
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  stop?.(); stop = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('PWA application lifecycle', () => {
  it('registers immediately and leaves activation reloads to controllerchange', () => {
    stop = initializePwa();
    expect(registerSW).toHaveBeenCalledOnce();
    expect(options().immediate).toBe(true);
    options().onNeedReload?.();
    expect(reload).not.toHaveBeenCalled();
  });
  it('checks the registered worker at exactly 60000ms intervals', async () => {
    stop = initializePwa(); registered();
    await vi.advanceTimersByTimeAsync(59_999);
    expect(update).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(update).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(update).toHaveBeenCalledTimes(2);
  });
  it('does not poll until a registration is available', async () => {
    stop = initializePwa();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(update).not.toHaveBeenCalled();
    options().onRegisteredSW?.('/sw.js', undefined);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(update).not.toHaveBeenCalled();
    registered();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(update).toHaveBeenCalledOnce();
  });
  it('checks when visible, not when hidden', async () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get');
    stop = initializePwa(); registered();
    visibility.mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(update).not.toHaveBeenCalled();
    visibility.mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve();
    expect(update).toHaveBeenCalledOnce();
  });
  it('keeps the offline app running and resumes checks after reconnecting', async () => {
    stop = initializePwa(); registered();
    vi.stubGlobal('navigator', { serviceWorker, onLine: false });
    await vi.advanceTimersByTimeAsync(60_000);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(update).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    vi.stubGlobal('navigator', { serviceWorker, onLine: true });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(update).toHaveBeenCalledOnce();
  });
  it('handles rejected updates and retries on the next poll', async () => {
    const error = new Error('offline during fetch');
    update.mockRejectedValueOnce(error);
    stop = initializePwa(); registered();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(console.warn).toHaveBeenCalledWith('Service worker update failed', error);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(update).toHaveBeenCalledTimes(2);
    expect(reload).not.toHaveBeenCalled();
  });
  it('does not overlap a pending update with a timer or visibility check', async () => {
    let finish!: () => void;
    update.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
    stop = initializePwa(); registered();
    await vi.advanceTimersByTimeAsync(60_000);
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(update).toHaveBeenCalledOnce();
    finish(); await Promise.resolve();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(update).toHaveBeenCalledTimes(2);
  });
  it('reloads once for an existing controller despite duplicate and later controller events', () => {
    stop = initializePwa();
    serviceWorker.dispatchEvent(new Event('controllerchange'));
    expect(reload).not.toHaveBeenCalled();
    changeController();
    serviceWorker.dispatchEvent(new Event('controllerchange'));
    changeController();
    options().onNeedReload?.();
    expect(reload).toHaveBeenCalledOnce();
  });
  it('skips first-install navigation but adopts a subsequent controller update', () => {
    serviceWorker.controller = null;
    stop = initializePwa();
    serviceWorker.dispatchEvent(new Event('controllerchange'));
    changeController();
    options().onNeedReload?.();
    serviceWorker.dispatchEvent(new Event('controllerchange'));
    expect(reload).not.toHaveBeenCalled();
    changeController();
    expect(reload).toHaveBeenCalledOnce();
  });
  it('handles registration errors without navigation or unusable polling', async () => {
    stop = initializePwa();
    const error = new Error('registration failed');
    options().onRegisterError?.(error);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(console.warn).toHaveBeenCalledWith('Service worker registration failed', error);
    expect(update).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });
  it('removes its timer and event listeners on cleanup', async () => {
    stop = initializePwa(); registered(); stop();
    document.dispatchEvent(new Event('visibilitychange'));
    changeController();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(update).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('does nothing when service workers are unsupported', () => {
    vi.stubGlobal('navigator', { onLine: true });
    stop = initializePwa();
    expect(registerSW).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
