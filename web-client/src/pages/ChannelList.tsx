import React, { useEffect, useState } from 'react';
import { useChannelStore } from '../store/channelStore';
import { useAuthStore } from '../store/authStore';

const ChannelList: React.FC = () => {
  const { channels, isLoading, error, loadChannels, createChannel, joinChannel, leaveChannel, deleteChannel } = useChannelStore();
  const { user, logout } = useAuthStore();
  const currentUserId = user?.userId;
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  useEffect(() => {
    loadChannels();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim()) {
      await createChannel(newName, newDesc);
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-blue-600">Channels</h1>
          <button
            onClick={logout}
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
          >
            Logout ({user?.callsign})
          </button>
        </div>
        
        {/* Create Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowCreate(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
          >
            Create Channel
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* Create Channel Modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white p-6 rounded-lg w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">Create Channel</h2>
              <form onSubmit={handleCreate}>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <textarea
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Channel List */}
        {isLoading ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {channels.map(channel => (
              <div key={channel.id} className="bg-white p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow">
                <h3 className="font-bold text-lg mb-2">{channel.name}</h3>
                {channel.description && (
                  <p className="text-gray-600 text-sm mb-2">{channel.description}</p>
                )}
                <div className="text-sm text-gray-500 mb-3">
                  <div>Admin: {channel.adminCallsign}</div>
                  <div>Members: {channel.memberCount}</div>
                </div>
                 <div className="flex gap-2">
                   <button
                     onClick={() => joinChannel(channel.id)}
                     disabled={channel.userRole != null}
                     className={`flex-1 py-2 rounded-md text-white ${
                       channel.userRole != null
                         ? 'bg-gray-400 cursor-not-allowed'
                         : 'bg-blue-600 hover:bg-blue-700'
                     }`}
                   >
                     {channel.userRole === 'ADMIN' ? 'Admin' : channel.userRole === 'LISTENER' ? 'Joined' : 'Join'}
                   </button>
                   <button
                     onClick={() => leaveChannel(channel.id)}
                     disabled={channel.userRole == null}
                     className={`flex-1 py-2 rounded-md text-white ${
                       channel.userRole == null
                         ? 'bg-gray-400 cursor-not-allowed'
                         : 'bg-red-600 hover:bg-red-700'
                     }`}
                   >
                     Leave
                   </button>
                  <button
                    onClick={() => {
                      if (confirm('Weet je zeker dat je dit kanaal wilt verwijderen?')) {
                        deleteChannel(channel.id);
                      }
                    }}
                    className="bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-800"
                    style={{ display: currentUserId === channel.adminId ? 'block' : 'none' }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChannelList;
