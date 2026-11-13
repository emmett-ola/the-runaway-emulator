import type { GameSettings } from '../../types';
import { loadUserData } from '../../storage';
export { GamesHub } from './GamesHub';
export { CardGame } from './CardGame';

export { getRunGame, registerRunGame } from './runContract';
export type { RunGame, RunRound, RunOutcome } from './runContract';

/** Run consumes game configuration through this interface, not hub internals. */
export async function loadGameSettings(username: string): Promise<GameSettings> {
  return (await loadUserData(username))?.settings?.games ?? {};
}
