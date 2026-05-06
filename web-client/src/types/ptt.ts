// TypeScript types for PTT WebRTC
export interface WebSocketMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'ptt-start' | 'ptt-stop' | 'connected';
  userId?: number; // Who sent this message
  targetUserId?: number; // Who this message is FOR (for routing)
  callsign?: string;
  channelId?: number;
  payload?: any;
  users?: Array<{userId: number, callsign: string}>; // For "connected" message
}

export interface PeerConnectionState {
  userId: number;
  callsign: string;
  connection: RTCPeerConnection;
  audioElement?: HTMLAudioElement;
}

export interface PTTState {
  isTransmitting: boolean;
  isReceiving: boolean;
  activeCaller: string;
  status: string;
  isConnected: boolean;
  error: string | null;
}

export const AUDIO_CONFIG = {
  codec: 'opus',
  sampleRate: 48000,
  channels: 1,
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true
};
