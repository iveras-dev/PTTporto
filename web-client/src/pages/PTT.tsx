import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWebSocket } from '../hooks/useWebSocket';
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
    error: null
  });
  
  const { localStream, initializeAudio, startRecording, stopRecording, cleanup: audioCleanup } = useAudio();
  const { 
    peerConnections, 
    handleOffer, 
    handleAnswer, 
    handleIceCandidate, 
    createOffer, 
    enableAudio,
    audioEnabled,
    closeAllConnections 
  } = useWebRTC({ localStream, currentUser: user, sendWebSocket: (msg) => send(msg) });
  
  const wsRef = React.useRef<{ send: (msg: WebSocketMessage | string) => void } | null>(null);
  
  // WebSocket message handler
  const handleWebSocketMessage = (message: WebSocketMessage) => {
    switch (message.type) {
      case 'offer':
        if (message.payload && message.userId && message.callsign) {
          handleOffer(message.userId, message.callsign, message.payload);
          setState(prev => ({ ...prev, isReceiving: true, activeCaller: message.callsign }));
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
          setState(prev => ({ ...prev, isReceiving: true, activeCaller: message.callsign }));
        }
        break;
        
      case 'ptt-stop':
        setState(prev => ({ ...prev, isReceiving: false, activeCaller: '' }));
        break;
    }
  };
  
  const { send, disconnect, isConnected } = useWebSocket({
    url: `ws://localhost:8082/ws/ptt/${channelId}?token=${encodeURIComponent(user?.accessToken || '')}`,
    onMessage: handleWebSocketMessage,
    onOpen: () => {
      setState(prev => ({ ...prev, isConnected: true, status: 'Connected', error: null }));
    },
    onClose: () => {
      setState(prev => ({ ...prev, isConnected: false, status: 'Disconnected' }));
      closeAllConnections();
    },
    onError: () => {
      setState(prev => ({ ...prev, error: 'WebSocket error occurred' }));
    }
  });
  
  // Store send function in ref for WebRTC callbacks
  useEffect(() => {
    wsRef.current = { send };
  }, [send]);
  
  const handlePTTPress = async () => {
    if (!isConnected || state.isReceiving || !user) return;
    
    // Notify others that PTT started
    send({ type: 'ptt-start', channelId: parseInt(channelId!), callsign: user.callsign });
    
    // Create WebRTC offer for all users in channel
    await createOffer(parseInt(channelId!), user.callsign);
    
    startRecording();
    setState(prev => ({ ...prev, isTransmitting: true, status: 'Transmitting...' }));
  };
  
  const handlePTTRelease = () => {
    if (!state.isTransmitting) return;
    
    send({ type: 'ptt-stop', channelId: parseInt(channelId!) });
    stopRecording();
    setState(prev => ({ ...prev, isTransmitting: false, status: 'Transmission ended' }));
  };
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
      audioCleanup();
      closeAllConnections();
    };
  }, [disconnect, audioCleanup, closeAllConnections]);
  
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
          
          {/* Audio Enable Section */}
          {!audioEnabled && (
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
                ${state.isReceiving || !state.isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
              onMouseDown={handlePTTPress}
              onMouseUp={handlePTTRelease}
              onTouchStart={handlePTTPress}
              onTouchEnd={handlePTTRelease}
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
