import type { GameSettings } from '../../types';
import { readRecord } from '../storage';
export { getRunGame, registerRunGame } from './runContract';
export type { RunGame, RunRound, RunOutcome } from './runContract';

/** Run consumes game configuration through this interface, not hub internals. */
export async function loadGameSettings(username: string): Promise<GameSettings> {
  return (await readRecord(username))?.settings?.games ?? {};
}
