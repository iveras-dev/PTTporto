export interface WebSocketMessage {
  type: 'ptt-start' | 'ptt-stop' | 'connected';
  userId?: number;
  callsign?: string;
  channelId?: number;
  users?: Array<{userId: number, callsign: string}>;
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
