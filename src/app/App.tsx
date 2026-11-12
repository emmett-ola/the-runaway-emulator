import { BrowserRouter } from 'react-router-dom';
import { Login } from '../components/Login';
import { AppRoutes } from './routes';
import { useSession } from './session';
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
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
