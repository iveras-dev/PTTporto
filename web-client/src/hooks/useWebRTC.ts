import { useRef, useState, useCallback } from 'react';
import { WebSocketMessage, PeerConnectionState } from '../types/ptt';

interface UseWebRTCOptions {
  localStream: React.RefObject<MediaStream | null>;
  currentUser: { userId: number; callsign: string } | null;
  sendWebSocket: (msg: WebSocketMessage | string) => void;
  onAudioError?: (error: string) => void;
}

export const useWebRTC = ({ localStream, currentUser, sendWebSocket, onAudioError }: UseWebRTCOptions) => {
  const peerConnections = useRef<Map<number, PeerConnectionState>>(new Map());
  const [audioEnabled, setAudioEnabled] = useState(false);
  
  const configuration: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };
  
  const createPeerConnection = useCallback((remoteUserId: number, remoteCallsign: string): RTCPeerConnection => {
    // Close existing connection if any
    const existing = peerConnections.current.get(remoteUserId);
    if (existing) {
      existing.connection.close();
      peerConnections.current.delete(remoteUserId);
    }
    
    const pc = new RTCPeerConnection(configuration);
    
    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && currentUser) {
        sendWebSocket({
          type: 'ice-candidate',
          userId: currentUser.userId,
          targetUserId: remoteUserId,
          callsign: currentUser.callsign,
          payload: event.candidate
        });
      }
    };
    
    // Handle incoming audio stream
    pc.ontrack = (event) => {
      console.log('[WebRTC] 🎧 TRACK RECEIVED from', remoteCallsign);
      const stream = event.streams[0];
      if (stream) {
        console.log('[WebRTC] Stream has', stream.getTracks().length, 'tracks');
        
        let audioEl = document.getElementById(`audio-${remoteUserId}`) as HTMLAudioElement;
        if (!audioEl) {
          audioEl = document.createElement('audio');
          audioEl.id = `audio-${remoteUserId}`;
          audioEl.controls = true;
          audioEl.autoplay = true;
          document.body.appendChild(audioEl);
          console.log('[WebRTC] Audio element created');
        }
        
        audioEl.srcObject = stream;
        console.log('[WebRTC] Set srcObject to remote stream');
        
        audioEl.play().then(() => {
          console.log('[WebRTC] ✅ Audio PLAYING!');
        }).catch(e => {
          console.error('[WebRTC] ❌ Audio play error:', e.message);
          audioEl.controls = true;
          if (onAudioError) onAudioError(e.message);
        });
      }
    };
    
    // Store connection
    peerConnections.current.set(remoteUserId, {
      userId: remoteUserId,
      callsign: remoteCallsign,
      connection: pc
    });
    
    return pc;
  }, [currentUser, sendWebSocket, onAudioError]);
  
  const handleOffer = useCallback(async (fromUserId: number, fromCallsign: string, offer: RTCSessionDescriptionInit) => {
    try {
      console.log(`[WebRTC] 📞 Received offer from ${fromCallsign} (${fromUserId})`);
      let pc = peerConnections.current.get(fromUserId);
      if (!pc) {
        console.log(`[WebRTC] Creating new peer connection for ${fromCallsign}`);
        pc = { userId: fromUserId, callsign: fromCallsign, connection: createPeerConnection(fromUserId, fromCallsign) };
        peerConnections.current.set(fromUserId, pc);
      }
      
      console.log(`[WebRTC] Setting remote description from ${fromCallsign}`);
      await pc.connection.setRemoteDescription(new RTCSessionDescription(offer));
      console.log(`[WebRTC] Creating answer for ${fromCallsign}`);
      const answer = await pc.connection.createAnswer();
      await pc.connection.setLocalDescription(answer);
      console.log(`[WebRTC] Answer created, sending to ${fromCallsign}`);
      
      if (currentUser) {
        sendWebSocket({
          type: 'answer',
          userId: currentUser.userId,
          targetUserId: fromUserId,
          callsign: currentUser.callsign,
          payload: answer
        });
        console.log(`[WebRTC] ✅ Answer sent to ${fromCallsign}`);
      }
    } catch (error) {
      console.error('[WebRTC] ❌ Error handling offer:', error);
    }
  }, [currentUser, sendWebSocket, createPeerConnection]);
  
  const handleAnswer = useCallback(async (fromUserId: number, answer: RTCSessionDescriptionInit) => {
    try {
      console.log(`[WebRTC] 📞 Received answer from ${fromUserId}`);
      const pc = peerConnections.current.get(fromUserId);
      if (pc) {
        await pc.connection.setRemoteDescription(new RTCSessionDescription(answer));
        console.log(`[WebRTC] ✅ Remote description set for ${fromUserId}`);
      } else {
        console.warn(`[WebRTC] ⚠️ No peer connection found for user ${fromUserId}`);
      }
    } catch (error) {
      console.error('[WebRTC] ❌ Error handling answer:', error);
    }
  }, []);
  
  const handleIceCandidate = useCallback(async (fromUserId: number, candidate: RTCIceCandidateInit) => {
    try {
      const pc = peerConnections.current.get(fromUserId);
      if (pc && candidate) {
        await pc.connection.addIceCandidate(new RTCIceCandidate(candidate));
        console.log(`[WebRTC] ✅ ICE candidate added for ${fromUserId}`);
      }
    } catch (error) {
      console.error('[WebRTC] ❌ Error handling ICE candidate:', error);
    }
  }, []);
  
  const createOffer = useCallback(async (targetUserId: number, targetCallsign: string): Promise<void> => {
    try {
      let pc = peerConnections.current.get(targetUserId);
      if (!pc) {
        pc = { userId: targetUserId, callsign: targetCallsign, connection: createPeerConnection(targetUserId, targetCallsign) };
        peerConnections.current.set(targetUserId, pc);
      }
      
      // Add local stream if available
      if (localStream.current) {
        localStream.current.getTracks().forEach(track => {
          pc!.connection.addTrack(track, localStream.current!);
        });
        console.log(`[WebRTC] Added local stream tracks for ${targetCallsign}`);
      }
      
      const offer = await pc.connection.createOffer();
      await pc.connection.setLocalDescription(offer);
      console.log(`[WebRTC] Offer created for ${targetCallsign}`);
      
      if (currentUser) {
        sendWebSocket({
          type: 'offer',
          userId: currentUser.userId,
          targetUserId: targetUserId,
          callsign: currentUser.callsign,
          payload: offer
        });
        console.log(`[WebRTC] ✅ Offer sent to ${targetCallsign}`);
      }
    } catch (error) {
      console.error('[WebRTC] ❌ Error creating offer:', error);
    }
  }, [currentUser, sendWebSocket, createPeerConnection, localStream]);
  
  const enableAudio = useCallback(() => {
    setAudioEnabled(true);
    peerConnections.current.forEach((_, userId) => {
      const audioEl = document.getElementById(`audio-${userId}`) as HTMLAudioElement;
      if (audioEl) {
        audioEl.play().catch(e => console.error('Play error:', e));
      }
    });
  }, []);
  
  const closeAllConnections = useCallback(() => {
    peerConnections.current.forEach((peer, userId) => {
      peer.connection.close();
      const audioEl = document.getElementById(`audio-${userId}`);
      if (audioEl) audioEl.remove();
    });
    peerConnections.current.clear();
  }, []);
  
  // Stop all connections and local stream (for PTT stop)
  const stopAllStreams = useCallback(() => {
    // Stop all tracks in PeerConnections
    peerConnections.current.forEach((peer) => {
      peer.connection.getSenders().forEach(sender => {
        if (sender.track) {
          sender.track.stop();
        }
      });
    });
    // Note: localStream is managed by useAudio hook
  }, []);
  
  const closeConnection = useCallback((userId: number) => {
    const peer = peerConnections.current.get(userId);
    if (peer) {
      peer.connection.close();
      const audioEl = document.getElementById(`audio-${userId}`);
      if (audioEl) audioEl.remove();
      peerConnections.current.delete(userId);
    }
  }, []);
  
  // Audio error callback (set by PTT component)
  const audioErrorCallbackRef = useRef<((error: string) => void) | null>(null);
  const setAudioErrorCallback = useCallback((callback: (error: string) => void) => {
    audioErrorCallbackRef.current = callback;
  }, []);
  
  return {
    peerConnections,
    createPeerConnection,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    createOffer,
    enableAudio,
    audioEnabled,
    closeAllConnections,
    closeConnection,
    stopAllStreams,
    setAudioErrorCallback
  };
};
