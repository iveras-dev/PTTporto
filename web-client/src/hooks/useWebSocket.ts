import { useRef, useCallback, useEffect } from 'react';
import { WebSocketMessage } from '../types/ptt';

interface UseWebSocketProps {
  url: string;
  onMessage: (message: WebSocketMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
}

export const useWebSocket = ({ url, onMessage, onOpen, onClose, onError }: UseWebSocketProps) => {
  const ws = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  
  const connect = useCallback(() => {
    try {
      ws.current = new WebSocket(url);
      
      ws.current.onopen = () => {
        reconnectAttempts.current = 0;
        onOpen?.();
      };
      
      ws.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          onMessage(message);
        } catch (e) {
          console.log('Non-JSON message:', event.data);
        }
      };
      
      ws.current.onclose = () => {
        onClose?.();
        
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          setTimeout(connect, 3000 * reconnectAttempts.current);
        }
      };
      
      ws.current.onerror = (error) => {
        onError?.(error);
      };
    } catch (error) {
      console.error('WebSocket connection error:', error);
    }
  }, [url, onMessage, onOpen, onClose, onError]);
  
  const send = useCallback((message: WebSocketMessage | string) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      const data = typeof message === 'string' ? message : JSON.stringify(message);
      ws.current.send(data);
    }
  }, []);
  
  const disconnect = useCallback(() => {
    if (ws.current) {
      reconnectAttempts.current = maxReconnectAttempts;
      ws.current.close();
      ws.current = null;
    }
  }, []);
  
  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);
  
  return {
    send,
    disconnect,
    isConnected: ws.current?.readyState === WebSocket.OPEN
  };
};
