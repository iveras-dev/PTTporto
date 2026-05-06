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
    
    // Monitor ICE connection state
    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE state for ${remoteCallsign}:`, pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        console.log(`[WebRTC] ✅ ICE connected for ${remoteCallsign}`);
      } else if (pc.iceConnectionState === 'failed') {
        console.error(`[WebRTC] ❌ ICE failed for ${remoteCallsign}`);
      } else if (pc.iceConnectionState === 'disconnected') {
        console.warn(`[WebRTC] ⚠️ ICE disconnected for ${remoteCallsign}`);
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
          audioEl.controls = false; // Hide controls by default
          audioEl.autoplay = true;
          audioEl.muted = false;
          document.body.appendChild(audioEl);
          console.log('[WebRTC] Audio element created');
        }
        
        audioEl.srcObject = stream;
        console.log('[WebRTC] Set srcObject to remote stream');
        
        // Try to play (may fail without user interaction)
        const playPromise = audioEl.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
              console.log('[WebRTC] ✅ Audio PLAYING!');
              // Verify audio is actually outputting
              setTimeout(() => {
                console.log('[WebRTC] Audio element verification:', {
                  volume: audioEl.volume,
                  muted: audioEl.muted,
                  paused: audioEl.paused,
                  readyState: audioEl.readyState
                });
              }, 1000);
            }).catch(e => {
              console.error('[WebRTC] ❌ Audio play error:', e.message);
              // Show enable audio button in UI
              if (audioErrorCallbackRef.current) {
                audioErrorCallbackRef.current(`Audio blocked for ${remoteCallsign}. Click "Enable Audio" to hear them.`);
              }
            });
        }
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
      
      // If connection exists and is in stable state with remote description, ignore duplicate offer
      if (pc && pc.connection.signalingState === 'stable' && pc.connection.remoteDescription) {
        console.log(`[WebRTC] ⚠️ Ignoring duplicate offer from ${fromCallsign} - connection already stable`);
        return;
      }
      
      if (!pc || pc.connection.signalingState === 'closed') {
        if (pc) {
          console.log(`[WebRTC] Cleaning up closed connection for ${fromCallsign}`);
          pc.connection.close();
        }
        console.log(`[WebRTC] Creating new peer connection for ${fromCallsign}`);
        pc = { userId: fromUserId, callsign: fromCallsign, connection: createPeerConnection(fromUserId, fromCallsign) };
        peerConnections.current.set(fromUserId, pc);
      }
      
      console.log(`[WebRTC] Setting remote description from ${fromCallsign}`);
      await pc.connection.setRemoteDescription(new RTCSessionDescription(offer));
      console.log(`[WebRTC] Remote description set for ${fromCallsign}`);
      
      console.log(`[WebRTC] Creating answer for ${fromCallsign}`);
      const answer = await pc.connection.createAnswer();
      await pc.connection.setLocalDescription(answer);
      
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
        // Only set remote description if we're in the right state
        if (pc.connection.signalingState === 'have-local-offer') {
          await pc.connection.setRemoteDescription(new RTCSessionDescription(answer));
          console.log(`[WebRTC] ✅ Remote description set for ${fromUserId}`);
        } else {
          console.warn(`[WebRTC] ⚠️ Skipping answer - signalingState is: ${pc.connection.signalingState}`);
        }
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
      
      // Only create new connection if none exists or it's in a closed state
      if (!pc || pc.connection.signalingState === 'closed' || pc.connection.iceConnectionState === 'closed') {
        if (pc) {
          console.log(`[WebRTC] Cleaning up old connection for ${targetCallsign}`);
          pc.connection.close();
        }
        pc = { userId: targetUserId, callsign: targetCallsign, connection: createPeerConnection(targetUserId, targetCallsign) };
        peerConnections.current.set(targetUserId, pc);
      } else if (pc.connection.signalingState !== 'stable') {
        console.log(`[WebRTC] ⚠️ Skipping offer - connection for ${targetCallsign} is in state: ${pc.connection.signalingState}`);
        return; // Skip if already in offer/answer process
      }
      
      // Add local stream if available
      if (localStream.current) {
        const audioTracks = localStream.current.getAudioTracks();
        console.log(`[WebRTC] Local stream has ${audioTracks.length} audio tracks`);
        audioTracks.forEach(track => {
          console.log(`[WebRTC] Audio track state:`, {
            enabled: track.enabled,
            muted: track.muted,
            readyState: track.readyState,
            label: track.label
          });
        });
        
        // Check if tracks are already added
        const senders = pc.connection.getSenders();
        const audioTrack = audioTracks[0];
        if (audioTrack && !senders.find(s => s.track?.id === audioTrack.id)) {
          pc.connection.addTrack(audioTrack, localStream.current);
          console.log(`[WebRTC] Added local stream tracks for ${targetCallsign}`);
        }
      } else {
        console.warn(`[WebRTC] ⚠️ No local stream available for ${targetCallsign}!`);
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
    console.log('[WebRTC] 🔊 Enabling audio for all connections');
    setAudioEnabled(true);
    peerConnections.current.forEach((_, userId) => {
      const audioEl = document.getElementById(`audio-${userId}`) as HTMLAudioElement;
      if (audioEl) {
        audioEl.muted = false;
        audioEl.volume = 1.0; // Max volume
        audioEl.play().then(() => {
          console.log(`[WebRTC] ✅ Audio enabled for ${userId}`);
        }).catch(e => {
          console.error('[WebRTC] ❌ Play error:', e.message);
          // Try again with user interaction
          audioEl.controls = true;
          audioEl.style.display = 'block';
        });
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
