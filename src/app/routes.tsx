import { SurfaceBoundary } from '../ui/SurfaceBoundary';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Home } from '../features/run';
import { GamesHub, CardGame } from '../features/games';

import { About, Releases } from '../features/about';
import { Settings } from '../features/settings';
import { Profile } from '../features/profile';

export function AppRoutes({ username, handleLogout }: { username: string; handleLogout: () => void }) {
  return (
      <SurfaceBoundary navigation={{ username, onLogout: handleLogout }}><Routes>
        <Route path="/" element={<Home username={username} onLogout={handleLogout} />} />
        <Route path="/games" element={<GamesHub />} />
        <Route path="/games/cards" element={<CardGame />} />

        <Route path="/releases" element={<Releases />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/about" element={<About />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes></SurfaceBoundary>
  );
}
