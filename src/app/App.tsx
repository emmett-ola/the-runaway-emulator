import { BrowserRouter } from 'react-router-dom';
import { Login } from '../ui/Login';
import { AppRoutes } from './routes';
import { useSession } from './session';
import { SceneSession } from '../features/scene';
import { useDocumentMeta } from './useDocumentMeta';
import '../App.css';

function AppContent() {
  const { username, handleLogin, handleLogout } = useSession();

  if (!username) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app">
      <AppRoutes username={username} handleLogout={handleLogout} />
    </div>
  );
}

function App() {
  useDocumentMeta();

  return (
    <SceneSession><BrowserRouter>
      <AppContent />
    </BrowserRouter></SceneSession>
  );
}

export default App;
