import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import ChannelList from './pages/ChannelList';
import PTT from './pages/PTT';
import { useAuthStore } from './store/authStore';

function App() {
  const { accessToken } = useAuthStore();
  
  return (
    <Routes>
      <Route path="/login" element={accessToken ? <Navigate to="/channels" /> : <Login />} />
      <Route path="/register" element={accessToken ? <Navigate to="/channels" /> : <Register />} />
      <Route path="/channels" element={accessToken ? <ChannelList /> : <Navigate to="/login" />} />
      <Route path="/ptt/:channelId" element={accessToken ? <PTT /> : <Navigate to="/login" />} />
      <Route path="/" element={<Navigate to="/channels" />} />
    </Routes>
  );
}

export default App;
