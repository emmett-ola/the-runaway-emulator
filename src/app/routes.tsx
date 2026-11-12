import { Routes, Route, Navigate } from 'react-router-dom';
import { Home } from '../pages/Home';
import { GamesHub } from '../pages/games/GamesHub';
import { CardGame } from '../pages/games/CardGame';

import { Releases } from '../pages/Releases';
import { Settings } from '../pages/Settings';
import { Profile } from '../pages/Profile';
import { About } from '../pages/About';

export function AppRoutes({ username, handleLogout }: { username: string; handleLogout: () => void }) {
  return (
      <Routes>
        <Route path="/" element={<Home username={username} onLogout={handleLogout} />} />
        <Route path="/games" element={<GamesHub />} />
        <Route path="/games/cards" element={<CardGame />} />

        <Route path="/releases" element={<Releases />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/about" element={<About />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
  );
}
