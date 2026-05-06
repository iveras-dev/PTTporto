import { useRef, useCallback, useEffect } from 'react';
import { AUDIO_CONFIG } from '../types/ptt';

export const useAudio = () => {
  const audioContext = useRef<AudioContext | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  
  const initializeAudio = useCallback(async (): Promise<MediaStream> => {
    try {
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: AUDIO_CONFIG.echoCancellation,
          noiseSuppression: AUDIO_CONFIG.noiseSuppression,
          autoGainControl: AUDIO_CONFIG.autoGainControl,
          sampleRate: AUDIO_CONFIG.sampleRate,
          channelCount: AUDIO_CONFIG.channels
        }
      });
      
      localStream.current = stream;
      
      // Create AudioContext for playback
      if (!audioContext.current) {
        audioContext.current = new AudioContext();
      }
      
      return stream;
    } catch (error) {
      console.error('Failed to initialize audio:', error);
      throw new Error('Microphone access denied or not available');
    }
  }, []);
  
  const startRecording = useCallback(() => {
    if (localStream.current && !mediaRecorder.current) {
      // Try different MIME types for compatibility
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        ''
      ];
      
      let recorder = null;
      for (const mimeType of mimeTypes) {
        try {
          const options = mimeType ? { mimeType } : undefined;
          recorder = new MediaRecorder(localStream.current!, options);
          break;
        } catch (e) {
          console.warn(`[Audio] MIME type ${mimeType} not supported, trying next...`);
        }
      }
      
      if (recorder) {
        mediaRecorder.current = recorder;
        // Add error handler
        mediaRecorder.current.onerror = (event) => {
          console.error('[Audio] ❌ MediaRecorder error:', event);
        };
        try {
          mediaRecorder.current.start();
          console.log('[Audio] ✅ MediaRecorder started with:', mediaRecorder.current.mimeType);
        } catch (startError) {
          console.error('[Audio] ❌ Start failed even after creation:', startError);
          mediaRecorder.current = null;
        }
      } else {
        console.error('[Audio] ❌ Failed to start MediaRecorder - no supported MIME type');
      }
    }
  }, []);
  
  const stopRecording = useCallback(() => {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
      mediaRecorder.current = null;
    }
  }, []);
  
  const cleanup = useCallback(() => {
    stopRecording();
    
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => track.stop());
      localStream.current = null;
    }
    
    if (audioContext.current) {
      audioContext.current.close();
      audioContext.current = null;
    }
  }, [stopRecording]);
  
  useEffect(() => {
    return cleanup;
  }, [cleanup]);
  
  return {
    localStream,
    audioContext,
    initializeAudio,
    startRecording,
    stopRecording,
    cleanup
  };
};
