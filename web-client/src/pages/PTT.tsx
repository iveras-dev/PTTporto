import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWebRTC } from '../hooks/useWebRTC';
import { useAudio } from '../hooks/useAudio';
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
  const [audioError, setAudioError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const { localStream, initializeAudio, startRecording, stopRecording, cleanup: audioCleanup } = useAudio();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const isTransmittingRef = useRef(false); // Ref to track transmitting state outside React state
  const spacePressedRef = useRef(false); // Track if spacebar is currently pressed
  const handlePTTPressRef = useRef<(() => void) | null>(null);
  const handlePTTReleaseRef = useRef<(() => void) | null>(null);
  
  // Stable sendWebSocket function
  const sendWebSocket = useCallback((msg: WebSocketMessage | string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  }, []);
  
  const { 
    handleOffer, 
    handleAnswer, 
    handleIceCandidate, 
    createOffer, 
    enableAudio,
    audioEnabled,
    closeAllConnections
  } = useWebRTC({ 
    localStream, 
    currentUser: user, 
    sendWebSocket,
    onAudioError: (error: string) => setAudioError(error)
  });
  
  // WebSocket message handler
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    console.log('[PTT] Processing message:', message.type, 'full message:', message);
    
    switch (message.type) {
      case 'connected':
        // Store user list for this channel
        if (message.users && Array.isArray(message.users)) {
          const users = message.users as Array<{userId: number, callsign: string}>;
          setChannelUsers(users);
          console.log('[PTT] ✅ Received user list:', users);
          // Also log to window for debugging
          (window as any).channelUsers = users;
        } else {
          console.warn('[PTT] ⚠️ No users array in connected message or not an array');
        }
        break;
      
      case 'offer':
        console.log('[PTT] 🎧 Offer received - payload:', !!message.payload, 'userId:', message.userId, 'callsign:', message.callsign, 'typeof handleOffer:', typeof handleOffer);
        if (message.payload && message.userId && message.callsign) {
          const callsign = message.callsign;
          console.log('[PTT] ✅ Conditions met, calling handleOffer...');
          handleOffer(message.userId, callsign, message.payload);
          setState(prev => ({ ...prev, isReceiving: true, activeCaller: callsign }));
        } else {
          console.warn('[PTT] ⚠️ Offer missing fields - payload:', !!message.payload, 'userId:', message.userId, 'callsign:', message.callsign);
        }
        break;
      
      case 'answer':
        if (message.payload && message.userId) {
          handleAnswer(message.userId, message.payload);
        }
        break;
      
      case 'ice-candidate':
        if (message.payload && message.userId) {
          handleIceCandidate(message.userId, message.payload);
        }
        break;
      
      case 'ptt-start':
        if (message.callsign) {
          // If someone else is already transmitting, ignore
          if (state.transmittingUserId && state.transmittingUserId !== message.userId) {
            console.warn('[PTT] ⚠️ Someone else is already transmitting');
            return;
          }
          const callsign = message.callsign;
          setState(prev => ({ ...prev, isReceiving: true, activeCaller: callsign, transmittingUserId: message.userId as number }));
        }
        break;
      
      case 'ptt-stop':
        setState(prev => ({ ...prev, isReceiving: false, activeCaller: '', transmittingUserId: null }));
        break;
    }
  }, [handleOffer, handleAnswer, handleIceCandidate, state.transmittingUserId]);
  
  // Use ref to avoid reconnects when handler changes
  const handleWebSocketMessageRef = useRef(handleWebSocketMessage);
  useEffect(() => {
    handleWebSocketMessageRef.current = handleWebSocketMessage;
  }, [handleWebSocketMessage]);
  
  // Connect WebSocket - only once per channelId+user
  useEffect(() => {
    if (!channelId || !user) {
      console.log('[PTT] Missing channelId or user, skipping WebSocket connect');
      return;
    }
    
    // Prevent duplicate connections
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('[PTT] WebSocket already connected, skipping');
      return;
    }
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname === 'localhost' ? 'localhost:8082' : `${window.location.hostname}:8082`;
    const wsUrl = `${protocol}//${host}/ws/ptt/${channelId}?token=${encodeURIComponent(user.accessToken || '')}`;
    
    console.log('[PTT] Connecting to WebSocket:', wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    
    ws.onopen = () => {
      console.log('[PTT] WebSocket connected successfully');
      setState(prev => ({ ...prev, isConnected: true, status: 'Connected', error: null }));
      reconnectAttempts.current = 0;
    };
    
    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        console.log('[PTT] Received:', message.type, message);
        handleWebSocketMessageRef.current?.(message);
      } catch (err) {
        console.error('[PTT] Failed to parse message:', err);
      }
    };
    
    ws.onclose = (event) => {
      console.log('[PTT] WebSocket disconnected:', event.code, event.reason);
      setState(prev => ({ ...prev, isConnected: false, status: 'Disconnected', transmittingUserId: null }));
      closeAllConnections();
      
      // Attempt to reconnect after delay (exponential backoff)
      if (!event.wasClean) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectAttempts.current += 1;
        console.log(`[PTT] Reconnecting in ${delay}ms...`);
        reconnectTimeoutRef.current = setTimeout(() => {
          if (wsRef.current === ws) {
            wsRef.current = null;
          }
        }, delay);
      }
    };
    
    ws.onerror = (event) => {
      console.error('[PTT] WebSocket error event:', event);
      const errorMsg = event instanceof ErrorEvent ? event.message : 'Unknown WebSocket error';
      setState(prev => ({ ...prev, error: `WebSocket error: ${errorMsg}. Check console (F12) for details.` }));
    };
    
    return () => {
      console.log('[PTT] Cleaning up WebSocket connection');
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      wsRef.current = null;
    };
  }, [channelId, user?.userId]); // Only reconnect if channelId or userId changes
  
  // Send function for WebSocket
  const send = (message: WebSocketMessage | string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof message === 'string' ? message : JSON.stringify(message));
    }
  };
  
  const isConnected = state.isConnected;
  
  const handlePTTPress = useCallback(async () => {
    // Guard: block if already transmitting (check ref immediately)
    if (isTransmittingRef.current) {
      console.log('[PTT] ⚠️ PTT press ignored - already transmitting (ref is true)');
      return;
    }
    
    // SET REF IMMEDIATELY to true (BEFORE any checks or async operations)
    isTransmittingRef.current = true;
    console.log('[PTT] 🎤 PTT PRESSED - isTransmittingRef set to true');
    
    // Block if someone else is transmitting (and it's not me)
    if (state.transmittingUserId && state.transmittingUserId !== user?.userId) {
      setState(prev => ({ ...prev, error: 'Channel is occupied by another user' }));
      isTransmittingRef.current = false; // Reset ref
      return;
    }
    
    if (!isConnected || state.isReceiving || !user) {
      isTransmittingRef.current = false; // Reset ref
      return;
    }
    
    // Initialize audio FIRST (get microphone stream)
    try {
      await initializeAudio();
      console.log('[PTT] ✅ Audio initialized before creating offers');
    } catch (error) {
      console.error('[PTT] ❌ Failed to initialize audio:', error);
      setAudioError('Failed to access microphone');
      isTransmittingRef.current = false; // Reset on error
      return;
    }
    
    // Create WebRTC offer for EACH user in channel (now localStream is set)
    for (const userInChannel of channelUsers) {
      console.log(`[PTT] Creating offer for user ${userInChannel.userId} (${userInChannel.callsign})`);
      await createOffer(userInChannel.userId, userInChannel.callsign);
    }
    
    // Notify others that PTT started (after offers are created)
    send({ type: 'ptt-start', channelId: parseInt(channelId!), callsign: user.callsign });
    setState(prev => ({ ...prev, transmittingUserId: user.userId }));
    
    startRecording();
    setState(prev => ({ ...prev, isTransmitting: true, status: 'Transmitting...' }));
    console.log('[PTT] ✅ PTT fully started');
  }, [state.transmittingUserId, state.isReceiving, isConnected, user, channelUsers, initializeAudio, createOffer, send, startRecording, channelId, setState]);
  
  const handlePTTRelease = useCallback(() => {
    if (!isTransmittingRef.current) {
      console.log('[PTT] ⚠️ Release ignored - not transmitting (ref is false)');
      spacePressedRef.current = false; // Reset anyway
      return; // Use ref to avoid stale closure
    }
    
    console.log('[PTT] 🔊 PTT RELEASED - stopping transmission');
    spacePressedRef.current = false; // Reset spacebar state
    send({ type: 'ptt-stop', channelId: parseInt(channelId!) });
    setState(prev => ({ ...prev, transmittingUserId: null }));
    stopRecording();
    setState(prev => ({ ...prev, isTransmitting: false, status: 'Transmission ended' }));
    isTransmittingRef.current = false; // Reset ref
    console.log('[PTT] ✅ PTT fully stopped');
  }, [send, channelId, stopRecording, setState]);
  
  // Update handler refs when callbacks change
  useEffect(() => {
    handlePTTPressRef.current = handlePTTPress;
    handlePTTReleaseRef.current = handlePTTRelease;
  }, [handlePTTPress, handlePTTRelease]);
  
  // Spacebar PTT support (stable listeners using refs)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !spacePressedRef.current) {
        e.preventDefault(); // Prevent page scroll
        spacePressedRef.current = true; // Mark spacebar as pressed
        console.log('[PTT] 🎤 Spacebar KEYDOWN detected');
        handlePTTPressRef.current?.();
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && spacePressedRef.current) {
        e.preventDefault();
        spacePressedRef.current = false; // Mark spacebar as released
        console.log('[PTT] 🔊 Spacebar KEYUP detected');
        handlePTTReleaseRef.current?.();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []); // Empty deps - listeners never change, they use refs
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      audioCleanup();
      closeAllConnections();
    };
  }, [audioCleanup, closeAllConnections]);
  
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
            </div>
          )}
          
          {/* Audio Error UI */}
          {(audioError || !audioEnabled) && (
            <div className="mb-4 p-4 bg-red-50 border border-red-400 rounded-md">
              <p className="text-red-800 mb-2">⚠️ {audioError || "NO AUDIO!"}</p>
              <p className="text-sm text-red-600">
                {audioError || 'Audio playback is blocked. Click enable audio.'}
              </p>
              <button
                onClick={() => {
                  enableAudio();
                  setAudioError(null);
                }}
                className="mt-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                🔊 Enable Audio
              </button>
            </div>
          )}
          
          {/* User List Badges - Above Status */}
          <div className="mb-4 flex flex-wrap gap-2">
            {channelUsers.map(user => (
              <span 
                key={user.userId}
                className={`px-3 py-1 rounded-full text-sm ${
                  state.transmittingUserId === user.userId 
                    ? 'bg-red-200 text-red-800' 
                    : 'bg-blue-100 text-blue-800'
                }`}
                title={user.callsign}
              >
                {user.callsign.length > 10 ? user.callsign.substring(0, 10) + '...' : user.callsign}
                {state.transmittingUserId === user.userId && ' 🎤'}
                {!audioEnabled && state.transmittingUserId === user.userId && ' 🔊'}
              </span>
            ))}
            {channelUsers.length === 0 && (
              <p className="text-gray-500 text-sm">No other users in this channel</p>
            )}
          </div>
          
          {/* Audio Enable Section */}
          {!audioEnabled && channelUsers.length > 0 && (
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-400 rounded-md">
              <p className="text-yellow-800 mb-2">⚠️ Audio playback may be blocked by browser policy</p>
              <button
                onClick={enableAudio}
                className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
              >
                🔊 Enable Audio Playback
              </button>
            </div>
          )}
          
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
                ${audioError ? 'opacity-50' : ''}
                ${state.isReceiving || !state.isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
              onMouseDown={handlePTTPress}
              onMouseUp={handlePTTRelease}
              onTouchStart={handlePTTPress}
              onTouchEnd={handlePTTRelease}
              disabled={!!audioError || state.isReceiving || !state.isConnected}
            >
              {audioError ? 'NO AUDIO!' : (state.isTransmitting ? 'TALKING...' : 'PTT')}
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
