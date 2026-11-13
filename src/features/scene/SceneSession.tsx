import type { ReactNode } from 'react';
import { SceneContext, usePageSceneClaim } from '../../lib/scene';

/** Page-memory only: survives routed surfaces, resets with the app document tree. */
export function SceneSession({ children }: { children: ReactNode }) {
  const claim = usePageSceneClaim();
  return <SceneContext.Provider value={claim}>{children}</SceneContext.Provider>;
}
