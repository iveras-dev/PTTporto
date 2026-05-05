const API_BASE = '/api/v1';

export interface ChannelResponse {
  id: number;
  name: string;
  description: string | null;
  adminId: number;
  adminCallsign: string;
  searchTags: string | null;
  memberCount: number;
  userRole?: string | null;
}

export interface CreateChannelRequest {
  name: string;
  description?: string | null;
}

export const channelAPI = {
  getAll: async (): Promise<ChannelResponse[]> => {
    const response = await fetch(`${API_BASE}/channels`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch channels');
    }
    return response.json();
  },

  create: async (request: CreateChannelRequest): Promise<ChannelResponse> => {
    const response = await fetch(`${API_BASE}/channels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
      },
      body: JSON.stringify(request)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create channel');
    }
    return response.json();
  },

  join: async (id: number): Promise<void> => {
    const response = await fetch(`${API_BASE}/channels/${id}/join`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to join channel');
    }
  },

  leave: async (id: number): Promise<void> => {
    const response = await fetch(`${API_BASE}/channels/${id}/leave`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to leave channel');
    }
  },

  delete: async (id: number): Promise<void> => {
    const response = await fetch(`${API_BASE}/channels/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete channel');
    }
  }
};
