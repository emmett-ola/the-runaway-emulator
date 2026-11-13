import type { ReactNode } from 'react';
import { Navigation } from './Navigation';
import { SurfaceBoundary } from './SurfaceBoundary';

interface LayoutProps {
  username: string;
  onLogout: () => void;
  children: ReactNode;
}

export const Layout = ({ username, onLogout, children }: LayoutProps) => {
  return (
    <>
      <Navigation
        username={username}
        onLogout={onLogout}
      />
      <SurfaceBoundary>{children}</SurfaceBoundary>
    </>
  );
};
