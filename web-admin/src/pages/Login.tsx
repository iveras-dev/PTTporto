import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setToken } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    try {
      const res = await fetch('http://127.0.0.1:8082/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Login failed')
      }
      
      const data = await res.json()
      setToken(data.accessToken)
      navigate('/users')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#111827' }}>
      <div style={{ background: '#1F2937', padding: '40px', borderRadius: '8px', width: '400px', border: '1px solid #374151' }}>
        <h1 style={{ color: '#EF4444', fontSize: '28px', fontWeight: 'bold', marginBottom: '30px' }}>PTTPorto Admin Login</h1>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: '#D1D5DB', fontSize: '14px', marginBottom: '8px' }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: '10px', background: '#374151', border: '1px solid #4B5563', borderRadius: '5px', color: 'white' }}
              required
            />
          </div>
          <div style={{ marginBottom: '25px' }}>
            <label style={{ display: 'block', color: '#D1D5DB', fontSize: '14px', marginBottom: '8px' }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', padding: '10px', background: '#374151', border: '1px solid #4B5563', borderRadius: '5px', color: 'white' }}
              required
            />
          </div>
          {error && (
            <div style={{ background: '#7F1D1D', border: '1px solid #991B1B', color: '#FECACA', padding: '10px', borderRadius: '5px', marginBottom: '20px' }}>
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', background: '#DC2626', color: 'white', padding: '10px', border: 'none', borderRadius: '5px', cursor: 'pointer', opacity: loading ? 0.5 : 1 }}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  )
}
