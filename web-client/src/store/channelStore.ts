import { create } from 'zustand';
import { channelAPI, ChannelResponse } from '../api/channels';

interface ChannelState {
  channels: ChannelResponse[];
  isLoading: boolean;
  error: string | null;
  userMemberships: { [channelId: number]: 'admin' | 'member' | null };
  
  loadChannels: () => Promise<void>;
  createChannel: (name: string, description?: string) => Promise<void>;
  joinChannel: (id: number) => Promise<void>;
  leaveChannel: (id: number) => Promise<void>;
  deleteChannel: (id: number) => Promise<void>;
  clearError: () => void;
}

export const useChannelStore = create<ChannelState>((set) => ({
  channels: [],
  isLoading: false,
  error: null,
  userMemberships: {},

  loadChannels: async () => {
    set({ isLoading: true, error: null });
    try {
      const channels = await channelAPI.getAll();
      set({ channels, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  createChannel: async (name: string, description?: string) => {
    set({ isLoading: true, error: null });
    try {
      await channelAPI.create({ name, description });
      const channels = await channelAPI.getAll();
      set({ channels, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  joinChannel: async (id: number) => {
    try {
      await channelAPI.join(id);
      const channels = await channelAPI.getAll();
      set((state) => ({ 
        channels,
        userMemberships: { ...state.userMemberships, [id]: 'member' }
      }));
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  leaveChannel: async (id: number) => {
    try {
      await channelAPI.leave(id);
      const channels = await channelAPI.getAll();
      set((state) => ({ 
        channels,
        userMemberships: { ...state.userMemberships, [id]: null }
      }));
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  deleteChannel: async (id: number) => {
    try {
      await channelAPI.delete(id);
      const channels = await channelAPI.getAll();
      set({ channels });
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  clearError: () => set({ error: null })
}));
