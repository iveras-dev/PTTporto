import React, { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useNavigate } from 'react-router-dom'

interface User {
  id: number
  email: string
  callsign: string
  role: string
  totpEnabled: boolean
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { token } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }
    fetchUsers()
  }, [token])

  const fetchUsers = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8082/api/v1/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) {
        if (res.status === 401) {
          navigate('/login')
          return
        }
        throw new Error('Failed to fetch users')
      }
      const data = await res.json()
      setUsers(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure?')) return
    try {
      const res = await fetch(`http://127.0.0.1:8082/api/v1/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        fetchUsers()
      }
    } catch (err: any) {
      setError(err.message)
    }
  }

  if (loading) return <div style={{ color: 'white' }}>Loading...</div>

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px' }}>User Management</h1>
      {error && (
        <div style={{ background: '#7F1D1D', border: '1px solid #991B1B', color: '#FECACA', padding: '12px', borderRadius: '5px', marginBottom: '16px' }}>
          {error}
        </div>
      )}
      <div style={{ background: '#1F2937', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', textAlign: 'left', color: '#D1D5DB' }}>
          <thead style={{ background: '#374151', color: '#E5E7EB' }}>
            <tr>
              <th style={{ padding: '12px 24px' }}>ID</th>
              <th style={{ padding: '12px 24px' }}>Email</th>
              <th style={{ padding: '12px 24px' }}>Callsign</th>
              <th style={{ padding: '12px 24px' }}>Role</th>
              <th style={{ padding: '12px 24px' }}>2FA</th>
              <th style={{ padding: '12px 24px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} style={{ borderBottom: '1px solid #374151' }}>
                <td style={{ padding: '16px 24px' }}>{user.id}</td>
                <td style={{ padding: '16px 24px' }}>{user.email}</td>
                <td style={{ padding: '16px 24px' }}>{user.callsign}</td>
                <td style={{ padding: '16px 24px' }}>{user.role}</td>
                <td style={{ padding: '16px 24px' }}>{user.totpEnabled ? 'Yes' : 'No'}</td>
                <td style={{ padding: '16px 24px' }}>
                  <button 
                    onClick={() => handleDelete(user.id)}
                    style={{ color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
