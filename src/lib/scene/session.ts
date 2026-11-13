import { createContext, useCallback, useContext, useRef } from 'react';
export const SceneContext = createContext<(() => boolean) | null>(null);

export function usePageSceneClaim() {
  const shown = useRef(false);
  return useCallback(() => {
    if (shown.current) return false;
    shown.current = true;
    return true;
  }, []);
}

export function useSceneTrigger() {
  const pageClaim = useContext(SceneContext);
  const fallback = usePageSceneClaim();
  return pageClaim ?? fallback;
}
