import { useState } from 'react';
import { WebSocketMessage, PeerConnectionState } from '../types/ptt';

interface UseWebRTCOptions {
  localStream: MediaStream | null;
  currentUser: { userId: number; callsign: string } | null;
  sendWebSocket: (msg: WebSocketMessage) => void;
}

export const useWebRTC = ({ localStream, currentUser, sendWebSocket }: UseWebRTCOptions) => {
  const [peerConnections] = useState<Map<number, PeerConnectionState>>(new Map());
  const [audioEnabled, setAudioEnabled] = useState(false);
  
  const configuration: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };
  
  const createPeerConnection = (remoteUserId: number, remoteCallsign: string): RTCPeerConnection => {
    // Close existing connection if any
    const existing = peerConnections.get(remoteUserId);
    if (existing) {
      existing.connection.close();
      peerConnections.delete(remoteUserId);
    }
    
    const pc = new RTCPeerConnection(configuration);
    
    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && currentUser) {
        sendWebSocket({
          type: 'ice-candidate',
          userId: currentUser.userId,
          targetUserId: remoteUserId, // This is FOR the remote user
          callsign: currentUser.callsign,
          payload: event.candidate
        });
      }
    };
    
    // Handle incoming audio stream - FIXED VERSION
    pc.ontrack = (event) => {
      console.log('[WebRTC] 🎧 TRACK RECEIVED from', remoteCallsign);
      const stream = event.streams[0];
      if (stream) {
        console.log('[WebRTC] Stream has', stream.getTracks().length, 'tracks');
        
        // Create or update audio element
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
        
        // Try to play - may fail without user gesture
        audioEl.play().then(() => {
          console.log('[WebRTC] ✅ Audio PLAYING!');
        }).catch(e => {
          console.error('[WebRTC] ❌ Audio play error:', e.message);
          // Show button to user
          audioEl.controls = true;
        });
      }
    };
    
    // Store connection
    peerConnections.set(remoteUserId, {
      userId: remoteUserId,
      callsign: remoteCallsign,
      connection: pc
    });
    
    return pc;
  };
  
  const handleOffer = async (fromUserId: number, fromCallsign: string, offer: RTCSessionDescriptionInit) => {
    try {
      let pc = peerConnections.get(fromUserId);
      if (!pc) {
        pc = { userId: fromUserId, callsign: fromCallsign, connection: createPeerConnection(fromUserId, fromCallsign) };
        peerConnections.set(fromUserId, pc);
      }
      
      await pc.connection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.connection.createAnswer();
      await pc.connection.setLocalDescription(answer);
      
      if (currentUser) {
        sendWebSocket({
          type: 'answer',
          userId: currentUser.userId, // Who is sending this answer (us)
          targetUserId: fromUserId, // Who this answer is FOR (the offerer)
          callsign: currentUser.callsign,
          payload: answer
        });
      }
    } catch (error) {
      console.error('[WebRTC] Error handling offer:', error);
    }
  };
  
  const handleAnswer = async (fromUserId: number, answer: RTCSessionDescriptionInit) => {
    try {
      const pc = peerConnections.get(fromUserId);
      if (pc) {
        await pc.connection.setRemoteDescription(new RTCSessionDescription(answer));
      }
    } catch (error) {
      console.error('[WebRTC] Error handling answer:', error);
    }
  };
  
  const handleIceCandidate = async (fromUserId: number, candidate: RTCIceCandidateInit) => {
    try {
      const pc = peerConnections.get(fromUserId);
      if (pc && candidate) {
        await pc.connection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (error) {
      console.error('[WebRTC] Error handling ICE candidate:', error);
    }
  };
  
  const createOffer = async (targetUserId: number, targetCallsign: string): Promise<void> => {
    try {
      let pc = peerConnections.get(targetUserId);
      if (!pc) {
        pc = { userId: targetUserId, callsign: targetCallsign, connection: createPeerConnection(targetUserId, targetCallsign) };
        peerConnections.set(targetUserId, pc);
      }
      
      // Add local stream if available
      if (localStream) {
        localStream.getTracks().forEach(track => {
          pc!.connection.addTrack(track, localStream);
        });
      }
      
      const offer = await pc.connection.createOffer();
      await pc.connection.setLocalDescription(offer);
      
      if (currentUser) {
        sendWebSocket({
          type: 'offer',
          userId: currentUser.userId, // Who is sending this offer (us)
          targetUserId: targetUserId, // Who this offer is FOR
          callsign: currentUser.callsign,
          payload: offer
        });
      }
    } catch (error) {
      console.error('[WebRTC] Error creating offer:', error);
    }
  };
  
  const enableAudio = () => {
    setAudioEnabled(true);
    // Enable all existing audio elements
     peerConnections.forEach((_, userId) => {
       const audioEl = document.getElementById(`audio-${userId}`) as HTMLAudioElement;
      if (audioEl) {
        audioEl.play().catch(e => console.error('Play error:', e));
      }
    });
  };
  
  const closeAllConnections = () => {
    peerConnections.forEach((peer, userId) => {
      peer.connection.close();
      // Remove audio element
      const audioEl = document.getElementById(`audio-${userId}`);
      if (audioEl) audioEl.remove();
    });
    peerConnections.clear();
  };
  
  const closeConnection = (userId: number) => {
    const peer = peerConnections.get(userId);
    if (peer) {
      peer.connection.close();
      const audioEl = document.getElementById(`audio-${userId}`);
      if (audioEl) audioEl.remove();
      peerConnections.delete(userId);
    }
  };
  
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
    closeConnection
  };
};
