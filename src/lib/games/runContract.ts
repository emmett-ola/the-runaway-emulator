import type { GameSettings } from '../../types';

export interface RunOutcome {
  count: boolean;
  scene: boolean;
  wrongAnimation: boolean;
}

export interface RunRound {
  controls: { id: string; labelKey: string; className?: string }[];
  containerClassName?: string;
  resolve: (controlId: string) => RunOutcome;
}

export interface RunGame {
  id: string;
  enabled: (settings: GameSettings) => boolean;
  createRound: () => RunRound;
}

const normalGame: RunGame = {
  id: 'normal', enabled: () => true,
  createRound: () => ({
    controls: [{ id: 'run', labelKey: 'dashboard.run_button' }],
    resolve: () => ({ count: true, scene: true, wrongAnimation: false }),
  }),
};

const forkGame: RunGame = {
  id: 'fork', enabled: settings => settings.forkInTheRoadEnabled === true,
  createRound: () => {
    const correctIndex = Math.floor(Math.random() * 3);
    return {
      containerClassName: 'fork-buttons-container',
      controls: ['left', 'middle', 'right'].map(id => ({ id, labelKey: 'dashboard.run_button', className: `fork-button ${id}` })),
      resolve: id => {
        const correct = ['left', 'middle', 'right'].indexOf(id) === correctIndex;
        return { count: correct, scene: correct, wrongAnimation: !correct };
      },
    };
  },
};

const runGames: RunGame[] = [forkGame];

/** Register inside games; Run only renders controls and applies the outcome. */
export function registerRunGame(game: RunGame): () => void {
  runGames.unshift(game);
  return () => {
    const index = runGames.indexOf(game);
    if (index !== -1) runGames.splice(index, 1);
  };
}

export const getRunGame = (settings: GameSettings): RunGame => runGames.find(game => game.enabled(settings)) ?? normalGame;
