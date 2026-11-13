import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { GamesHub, CardGame } from './index';
import { readRecord, writeRecord } from '../../lib/storage';
import { i18n } from '../../lib/i18n';
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); i18n.setLanguage('en_us');
  sessionStorage.setItem('runawaylog-username', 'player');
  writeRecord({ username: 'player', hits: [], registeredAt: 1, profile: {}, cardCollections: { '#001': 7, '#007': 2 } });
  writeRecord({ username: 'peer', hits: [], registeredAt: 1, profile: {} });
});
afterEach(cleanup);
it('persists keyboard-accessible game toggles per user and leaves coming-soon controls inert', async () => {
  const first = render(<MemoryRouter><GamesHub /></MemoryRouter>);
  await act(async () => {});
  fireEvent.click(screen.getByRole('switch', { name: i18n.t('games.card_drop') }));
  await waitFor(() => expect(readRecord('player')?.settings?.games?.cardDropEnabled).toBe(true));
  fireEvent.click(screen.getByRole('switch', { name: i18n.t('games.fork_in_the_road') }));
  await waitFor(() => expect(readRecord('player')?.settings?.games?.forkInTheRoadEnabled).toBe(true));
  expect(readRecord('peer')?.settings).toBeUndefined();
  expect(first.container.querySelectorAll('.game-card.disabled')).toHaveLength(3);
  for (const card of first.container.querySelectorAll('.game-card.disabled')) {
    expect(card).toHaveTextContent(i18n.t('games.coming_soon'));
    expect(card.querySelector('button:not(:disabled), input, [tabindex="0"]')).toBeNull();
  }
  first.unmount();
  render(<MemoryRouter><GamesHub /></MemoryRouter>);
  await waitFor(() => expect(screen.getByRole('switch', { name: i18n.t('games.fork_in_the_road') })).toHaveAttribute('aria-checked', 'true'));
  const before = JSON.stringify(readRecord('player'));
  fireEvent.click(screen.getByRole('button', { name: i18n.t('games.card_album') }));
  await screen.findByText(i18n.t('games.album_owned_count', { count: 7 }));
  fireEvent.click(screen.getByRole('button', { name: '✕' }));
  expect(JSON.stringify(readRecord('player'))).toBe(before);
});
it('returns from the card page to its games hub', () => {
  render(<MemoryRouter initialEntries={['/games/cards']}><Routes><Route path="/games/cards" element={<CardGame />} /><Route path="/games" element={<h1>Hub destination</h1>} /></Routes></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: i18n.t('games.hub_title') }));
  expect(screen.getByRole('heading', { name: 'Hub destination' })).toBeInTheDocument();
});
