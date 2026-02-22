import Layout from './components/Layout';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useTheme } from './hooks/useTheme';

function App() {
  useTheme();
  useKeyboardShortcuts();
  return <Layout />;
}

export default App;
