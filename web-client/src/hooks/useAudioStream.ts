import { useRef, useCallback } from 'react';

export const useAudioStream = () => {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioCacheRef = useRef<Blob[]>([]);

  const startMic = useCallback(async (): Promise<MediaStream> => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });
    localStreamRef.current = stream;
    return stream;
  }, []);

  const startTransmitting = useCallback((ws: WebSocket) => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', ''];
    let recorder: MediaRecorder | null = null;
    for (const mt of mimeTypes) {
      try {
        recorder = new MediaRecorder(stream, mt ? { mimeType: mt } : undefined);
        break;
      } catch {}
    }
    if (!recorder) return;

    mediaRecorderRef.current = recorder;
    audioCacheRef.current = [];

    recorder.ondataavailable = async (e) => {
      if (e.data.size > 0) {
        console.log('[AudioStream] 📦 Data available:', e.data.size, 'bytes');
        const buffer = await e.data.arrayBuffer();
        console.log('[AudioStream] 🚀 Sending binary:', buffer.byteLength, 'bytes');
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(buffer);
          console.log('[AudioStream] ✅ Sent to WebSocket');
        } else {
          console.warn('[AudioStream] ⚠️ WebSocket not open, state:', ws.readyState);
        }
      }
    };

    recorder.start(100);
  }, []);

  const stopTransmitting = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    mediaRecorderRef.current = null;
  }, []);

  const playAudioChunk = useCallback((data: ArrayBuffer, audioEl: HTMLAudioElement) => {
    try {
      const blob = new Blob([data], { type: 'audio/webm' });
      const url = URL.createObjectURL(blob);
      audioEl.src = url;
      audioEl.play().catch(() => {});
    } catch (e) {
      console.error('[AudioStream] Play error:', e);
    }
  }, []);

  const stopPlayback = useCallback(() => {
    audioCacheRef.current = [];
  }, []);

  const cleanup = useCallback(() => {
    stopTransmitting();
    stopPlayback();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
  }, [stopTransmitting, stopPlayback]);

  return {
    startMic,
    startTransmitting,
    stopTransmitting,
    playAudioChunk,
    stopPlayback,
    cleanup,
  };
};
