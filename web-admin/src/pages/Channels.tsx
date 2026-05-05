import React, { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useNavigate } from 'react-router-dom'

interface Channel {
  id: number
  name: string
  description: string | null
  adminCallsign: string
  memberCount: number
}

export default function Channels() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { token } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }
    fetchChannels()
  }, [token])

  const fetchChannels = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8082/api/v1/channels', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Failed to fetch channels')
      const data = await res.json()
      setChannels(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div style={{ color: 'white' }}>Loading...</div>

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px' }}>Channel Management</h1>
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
              <th style={{ padding: '12px 24px' }}>Name</th>
              <th style={{ padding: '12px 24px' }}>Description</th>
              <th style={{ padding: '12px 24px' }}>Admin</th>
              <th style={{ padding: '12px 24px' }}>Members</th>
            </tr>
          </thead>
          <tbody>
            {channels.map(channel => (
              <tr key={channel.id} style={{ borderBottom: '1px solid #374151' }}>
                <td style={{ padding: '16px 24px' }}>{channel.id}</td>
                <td style={{ padding: '16px 24px' }}>{channel.name}</td>
                <td style={{ padding: '16px 24px' }}>{channel.description || '-'}</td>
                <td style={{ padding: '16px 24px' }}>{channel.adminCallsign}</td>
                <td style={{ padding: '16px 24px' }}>{channel.memberCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
