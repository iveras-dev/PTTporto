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
      const options = {
        mimeType: 'audio/webm;codecs=opus'
      };
      
      try {
        mediaRecorder.current = new MediaRecorder(localStream.current, options);
      } catch (e) {
        // Fallback to default codec
        mediaRecorder.current = new MediaRecorder(localStream.current);
      }
      
      mediaRecorder.current.start();
    }
  }, []);
  
  const stopRecording = useCallback(() => {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
      mediaRecorder.current = null;
    }
  }, []);
  
  const playAudio = useCallback((stream: MediaStream) => {
    if (audioContext.current) {
      const source = audioContext.current.createMediaStreamSource(stream);
      source.connect(audioContext.current.destination);
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
    playAudio,
    cleanup
  };
};
