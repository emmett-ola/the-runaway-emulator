import { Component, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useT } from '../lib/i18n';
import { Navigation } from './Navigation';
type NavigationProps = { username: string; onLogout: () => void };

function Fallback({ retry }: { retry: () => void }) {
  const t = useT();
  return <section role="alert"><h1>{t('surface_error.title')}</h1><button onClick={retry}>{t('surface_error.retry')}</button></section>;
}

class RenderBoundary extends Component<{ children: ReactNode; navigation?: NavigationProps }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <>{this.props.navigation && <Navigation {...this.props.navigation} />}<Fallback retry={() => this.setState({ failed: false })} /></> : this.props.children;
  }
}

/** The route key resets failures; navigation stays outside this boundary. */
export function SurfaceBoundary({ children, navigation }: { children: ReactNode; navigation?: NavigationProps }) {
  const { pathname } = useLocation();
  return <RenderBoundary key={pathname} navigation={navigation}>{children}</RenderBoundary>;
}
