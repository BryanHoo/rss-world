import Layout from './components/Layout';
import { useTheme } from './hooks/useTheme';

function App() {
  useTheme();
  return <Layout />;
}

export default App;
