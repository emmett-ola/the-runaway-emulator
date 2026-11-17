/// <reference types="vite-plugin-pwa/client" />
import { registerSW } from 'virtual:pwa-register';

export function initializePwa() {
  if (!('serviceWorker' in navigator)) return () => {};

  const serviceWorker = navigator.serviceWorker;
  let previousController = serviceWorker.controller;
  let reloading = false;
  const onControllerChange = () => {
    const controller = serviceWorker.controller;
    if (!controller || controller === previousController) return;
    const updating = previousController !== null;
    previousController = controller;
    if (updating && !reloading) {
      reloading = true;
      window.location.reload();
    }
  };
  serviceWorker.addEventListener('controllerchange', onControllerChange);

  let registration: ServiceWorkerRegistration | undefined;
  let checking = false;
  const checkForUpdate = async () => {
    if (!registration || !navigator.onLine || checking) return;
    checking = true;
    try { await registration.update(); }
    catch (error) { console.warn('Service worker update failed', error); }
    finally { checking = false; }
  };
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') void checkForUpdate();
  };
  const interval = window.setInterval(() => { void checkForUpdate(); }, 60_000);
  document.addEventListener('visibilitychange', onVisibilityChange);
  registerSW({
    immediate: true,
    // Workbox also requests reloads on activation. Only controllerchange owns navigation.
    onNeedReload: () => {},
    onRegisteredSW: (_url, registered) => { registration = registered; },
    onRegisterError: error => { console.warn('Service worker registration failed', error); },
  });

  return () => {
    window.clearInterval(interval);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    serviceWorker.removeEventListener('controllerchange', onControllerChange);
  };
}
