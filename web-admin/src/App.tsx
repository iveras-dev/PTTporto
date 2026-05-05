import React, { useEffect } from 'react'
import { Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Login from './pages/Login'
import Users from './pages/Users'
import Channels from './pages/Channels'

function App() {
  const { token, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  if (!token) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#111827', color: 'white' }}>
      {/* Sidebar */}
      <div style={{ width: '250px', background: '#1F2937', padding: '20px', borderRight: '1px solid #374151' }}>
        <h2 style={{ color: '#EF4444', marginBottom: '30px' }}>PTTPorto Admin</h2>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li style={{ marginBottom: '10px' }}>
            <Link to="/users" style={{ color: 'white', textDecoration: 'none', display: 'block', padding: '10px', borderRadius: '5px' }}>Users</Link>
          </li>
          <li>
            <Link to="/channels" style={{ color: 'white', textDecoration: 'none', display: 'block', padding: '10px', borderRadius: '5px' }}>Channels</Link>
          </li>
        </ul>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <header style={{ background: '#1F2937', padding: '15px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #374151' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Dashboard</h1>
          <button onClick={handleLogout} style={{ background: '#DC2626', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Logout</button>
        </header>

        {/* Content area */}
        <main style={{ flex: 1, padding: '30px' }}>
          <Routes>
            <Route path="/users" element={<Users />} />
            <Route path="/channels" element={<Channels />} />
            <Route path="*" element={<Navigate to="/users" />} />
          </Routes>
        </main>
      </div>

      {/* Right sidebar */}
      <div style={{ width: '250px', background: '#1F2937', padding: '20px', borderLeft: '1px solid #374151' }}>
        <p style={{ color: '#9CA3AF', fontSize: '14px' }}>Future content here</p>
      </div>
    </div>
  )
}

export default App
