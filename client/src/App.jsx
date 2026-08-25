import { Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import HostDashboard from './pages/HostDashboard';
import PlayerGame from './pages/PlayerGame';
import HostLogin from './pages/HostLogin';
import PlayerJoin from './pages/PlayerJoin';
import PlayerDashboard from './pages/PlayerDashboard';
import QuizBuilder from './pages/QuizBuilder';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/host/login" element={<HostLogin />} />
      <Route path="/player" element={<PlayerDashboard />} />
      <Route path="/player/join" element={<PlayerJoin />} />
      <Route path="/host" element={<ProtectedRoute><HostDashboard /></ProtectedRoute>} />
      <Route path="/host/quiz-builder" element={<ProtectedRoute><QuizBuilder /></ProtectedRoute>} />
      <Route path="/host/quiz-builder/:id" element={<ProtectedRoute><QuizBuilder /></ProtectedRoute>} />
      <Route path="/game/:pin" element={<PlayerGame />} />
    </Routes>
  );
}

export default App;
