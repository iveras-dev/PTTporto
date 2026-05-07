import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAudioStream } from '../hooks/useAudioStream';
import { WebSocketMessage } from '../types/ptt';
import { useAuthStore } from '../store/authStore';

interface PTTState {
  isTransmitting: boolean;
  isReceiving: boolean;
  activeCaller: string;
  status: string;
  isConnected: boolean;
  error: string | null;
  transmittingUserId: number | null;
}

const PTT: React.FC = () => {
  const { channelId } = useParams<{ channelId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);

  const [state, setState] = useState<PTTState>({
    isTransmitting: false,
    isReceiving: false,
    activeCaller: '',
    status: 'Connecting...',
    isConnected: false,
    error: null,
    transmittingUserId: null
  });

  const [channelUsers, setChannelUsers] = useState<Array<{userId: number, callsign: string}>>([]);
  const [audioEnabled, setAudioEnabled] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const isTransmittingRef = useRef(false);
  const spacePressedRef = useRef(false);
  const handlePTTPressRef = useRef<(() => void) | null>(null);
  const handlePTTReleaseRef = useRef<(() => void) | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  const { startMic, startTransmitting, stopTransmitting, playAudioChunk, stopPlayback, cleanup: audioCleanup } = useAudioStream();

  const sendJson = useCallback((msg: WebSocketMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // WebSocket message handler
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'connected':
        if (message.users && Array.isArray(message.users)) {
          const users = (message.users as Array<{userId: number, callsign: string}>)
            .filter(u => u.userId !== user?.userId);
          setChannelUsers(users);
          console.log('[PTT] ✅ Received user list:', users);
        }
        break;

      case 'ptt-start':
        if (message.callsign) {
          setState(prev => ({
            ...prev,
            isReceiving: true,
            activeCaller: message.callsign || '',
            transmittingUserId: message.userId as number
          }));
        }
        break;

      case 'ptt-stop':
        setState(prev => ({
          ...prev,
          isReceiving: false,
          activeCaller: '',
          transmittingUserId: null
        }));
        break;
    }
  }, []);

  const handleWebSocketMessageRef = useRef(handleWebSocketMessage);
  useEffect(() => { handleWebSocketMessageRef.current = handleWebSocketMessage; }, [handleWebSocketMessage]);

  // WebSocket connection
  useEffect(() => {
    if (!channelId || !user) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname === 'localhost' ? 'localhost:8082' : `${window.location.hostname}:8082`;
    const wsUrl = `${protocol}//${host}/ws/ptt/${channelId}?token=${encodeURIComponent(user.accessToken || '')}`;

    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      setState(prev => ({ ...prev, isConnected: true, status: 'Connected', error: null }));
      reconnectAttempts.current = 0;
    };

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          handleWebSocketMessageRef.current?.(message);
        } catch (err) {
          console.error('[PTT] Parse error:', err);
        }
      } else if (event.data instanceof ArrayBuffer) {
        console.log('[PTT] 📦 Binary received:', event.data.byteLength, 'bytes');
        if (audioElRef.current) {
          console.log('[PTT] 🔊 Playing audio chunk');
          playAudioChunk(event.data, audioElRef.current);
        } else {
          console.warn('[PTT] ⚠️ No audio element available');
        }
      }
    };

    ws.onclose = (event) => {
      setState(prev => ({
        ...prev,
        isConnected: false,
        status: 'Disconnected',
        transmittingUserId: null,
        isReceiving: false
      }));

      if (!event.wasClean) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectAttempts.current += 1;
        reconnectTimeoutRef.current = setTimeout(() => {
          if (wsRef.current === ws) wsRef.current = null;
        }, delay);
      }
    };

    ws.onerror = () => {
      setState(prev => ({ ...prev, error: 'WebSocket connection error' }));
    };

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current === ws) {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close();
        wsRef.current = null;
      }
    };
  }, [channelId, user?.userId]);

  const isConnected = state.isConnected;

  const handlePTTPress = useCallback(async () => {
    if (isTransmittingRef.current) return;
    isTransmittingRef.current = true;

    if (state.transmittingUserId && state.transmittingUserId !== user?.userId) {
      setState(prev => ({ ...prev, error: 'Channel is occupied by another user' }));
      isTransmittingRef.current = false;
      return;
    }

    if (!isConnected || state.isReceiving || !user) {
      isTransmittingRef.current = false;
      return;
    }

    try {
      await startMic();
      if (wsRef.current) startTransmitting(wsRef.current);
      sendJson({ type: 'ptt-start', channelId: parseInt(channelId!), callsign: user.callsign });
      setState(prev => ({ ...prev, transmittingUserId: user.userId, isTransmitting: true, status: 'Transmitting...' }));
    } catch (e) {
      setState(prev => ({ ...prev, error: 'Microphone access denied' }));
      isTransmittingRef.current = false;
    }
  }, [state.transmittingUserId, state.isReceiving, isConnected, user, channelId, startMic, startTransmitting, sendJson]);

  const handlePTTRelease = useCallback(() => {
    if (!isTransmittingRef.current) {
      spacePressedRef.current = false;
      return;
    }

    stopTransmitting();
    sendJson({ type: 'ptt-stop', channelId: parseInt(channelId!) });
    setState(prev => ({ ...prev, transmittingUserId: null, isTransmitting: false, status: 'Transmission ended' }));
    isTransmittingRef.current = false;
    spacePressedRef.current = false;
  }, [channelId, stopTransmitting, sendJson]);

  useEffect(() => {
    handlePTTPressRef.current = handlePTTPress;
    handlePTTReleaseRef.current = handlePTTRelease;
  }, [handlePTTPress, handlePTTRelease]);

  // Spacebar PTT
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        if (!spacePressedRef.current) {
          spacePressedRef.current = true;
          handlePTTPressRef.current?.();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (spacePressedRef.current) {
          spacePressedRef.current = false;
          handlePTTReleaseRef.current?.();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Hidden audio element
  useEffect(() => {
    if (!audioElRef.current) {
      const audio = document.createElement('audio');
      audio.id = 'ptt-audio';
      audio.volume = 1.0;
      audio.autoplay = true;
      audio.style.display = 'none';
      document.body.appendChild(audio);
      audioElRef.current = audio;
    }
    return () => {
      if (audioElRef.current) {
        audioElRef.current.remove();
        audioElRef.current = null;
      }
    };
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      audioCleanup();
      stopPlayback();
    };
  }, [audioCleanup, stopPlayback]);

  const enableAudio = useCallback(() => {
    setAudioEnabled(true);
    if (audioElRef.current) {
      audioElRef.current.play().catch(() => {});
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate('/channels')}
          className="mb-6 text-blue-600 hover:underline"
        >
          ← Back to Channels
        </button>

        <div className="bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-3xl font-bold text-blue-600 mb-6">
            Channel {channelId}
          </h1>

          {state.error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {state.error}
              <button onClick={() => setState(prev => ({ ...prev, error: null }))} className="ml-2 underline">
                Dismiss
              </button>
            </div>
          )}

          {!audioEnabled && (
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-400 rounded-md">
              <p className="text-yellow-800 mb-2">⚠️ NO AUDIO! Click to enable.</p>
              <button
                onClick={enableAudio}
                className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
              >
                🔊 Enable Audio
              </button>
            </div>
          )}

          <div className="mb-4 flex flex-wrap gap-2">
            {channelUsers.map(u => (
              <span
                key={u.userId}
                className={`px-3 py-1 rounded-full text-sm ${
                  state.transmittingUserId === u.userId
                    ? 'bg-red-200 text-red-800'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                {u.callsign.length > 10 ? u.callsign.substring(0, 10) + '...' : u.callsign}
                {state.transmittingUserId === u.userId && ' 🎤'}
              </span>
            ))}
            {channelUsers.length === 0 && (
              <p className="text-gray-500 text-sm">No other users in this channel</p>
            )}
          </div>

          <div className="mb-6 p-4 bg-gray-50 rounded-md">
            <div className="text-lg font-semibold mb-2">
              Status: <span className={
                state.isTransmitting ? 'text-red-600' :
                state.isReceiving ? 'text-green-600' : 'text-gray-600'
              }>
                {state.status}
              </span>
            </div>
            {state.isReceiving && (
              <div className="text-gray-600">
                Receiving from: <span className="font-bold">{state.activeCaller}</span>
              </div>
            )}
          </div>

          <div className="flex justify-center">
            <button
              className={`w-48 h-48 rounded-full text-white text-2xl font-bold
                ${state.isTransmitting ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}
                ${state.isReceiving || !state.isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); handlePTTPress(); }}
              onMouseUp={(e) => { e.preventDefault(); handlePTTRelease(); }}
              onTouchStart={(e) => { e.preventDefault(); handlePTTPress(); }}
              onTouchEnd={(e) => { e.preventDefault(); handlePTTRelease(); }}
              disabled={state.isReceiving || !state.isConnected}
            >
              {state.isTransmitting ? 'TALKING...' : 'PTT'}
            </button>
          </div>

          <p className="mt-4 text-center text-gray-500">
            Press and hold to talk. Release to stop.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PTT;
