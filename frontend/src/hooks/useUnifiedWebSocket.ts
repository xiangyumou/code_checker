import { useState, useEffect, useRef, useCallback } from 'react';
import { useWebSocket } from '@/api/centralized';
import type { RequestSummary, AnalysisRequest } from '../types/index';

type WebSocketConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseUnifiedWebSocketProps {
  enabled?: boolean;
  onRequestCreated?: (request: RequestSummary) => void;
  onRequestUpdated?: (update: Partial<RequestSummary> & { id: number }) => void;
  onRequestDeleted?: (deletedId: number) => void;
  onSelectedRequestUpdated?: (requestId: number, partialUpdate?: Partial<AnalysisRequest>) => void;
  onConnectionEstablished?: () => void;
  onConnectionLost?: () => void;
  onError?: (error: any) => void;
  maxReconnectAttempts?: number;
  reconnectDelayMs?: number;
}

interface UseUnifiedWebSocketReturn {
  status: WebSocketConnectionStatus;
  isConnected: boolean;
  reconnectAttempts: number;
}

export const useUnifiedWebSocket = ({
  enabled = true,
  onRequestCreated,
  onRequestUpdated,
  onRequestDeleted,
  onSelectedRequestUpdated,
  onConnectionEstablished,
  onConnectionLost,
  onError,
  maxReconnectAttempts = 5,
  reconnectDelayMs = 3000,
}: UseUnifiedWebSocketProps): UseUnifiedWebSocketReturn => {
  const [status, setStatus] = useState<WebSocketConnectionStatus>('disconnected');
  const webSocketHook = useWebSocket;
  const wsConnectedRef = useRef(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  
  // Store callbacks in refs to avoid reconnection on prop changes
  const callbacksRef = useRef({
    onRequestCreated,
    onRequestUpdated,
    onRequestDeleted,
    onSelectedRequestUpdated,
    onConnectionEstablished,
    onConnectionLost,
    onError,
  });

  // Update refs when callbacks change
  useEffect(() => {
    callbacksRef.current = {
      onRequestCreated,
      onRequestUpdated,
      onRequestDeleted,
      onSelectedRequestUpdated,
      onConnectionEstablished,
      onConnectionLost,
      onError,
    };
  }, [
    onRequestCreated,
    onRequestUpdated,
    onRequestDeleted,
    onSelectedRequestUpdated,
    onConnectionEstablished,
    onConnectionLost,
    onError,
  ]);

  const setupEventHandlers = useCallback(() => {
    const cleanupHandlers = [
      webSocketHook.on('connection_established', () => {
        setStatus('connected');
        wsConnectedRef.current = true;
        reconnectAttemptsRef.current = 0;
        callbacksRef.current.onConnectionEstablished?.();
      }),
      
      webSocketHook.on('connection_lost', () => {
        setStatus('disconnected');
        wsConnectedRef.current = false;
        callbacksRef.current.onConnectionLost?.();
        
        // Auto-reconnect with exponential backoff
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = reconnectDelayMs * Math.pow(2, reconnectAttemptsRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current += 1;
            setStatus('connecting');
            webSocketHook.connect();
          }, delay);
        } else {
          setStatus('error');
        }
      }),
      
      webSocketHook.on('error', (event) => {
        setStatus('error');
        callbacksRef.current.onError?.(event);
      }),

      webSocketHook.on('request_created', (event) => {
        const payload = event.payload as RequestSummary;
        callbacksRef.current.onRequestCreated?.(payload);
      }),
      
      webSocketHook.on('request_updated', (event) => {
        const payload = event.payload as Partial<RequestSummary> & { id: number };
        callbacksRef.current.onRequestUpdated?.(payload);
        // For admin, we pass the payload as partial update
        // For user, we just pass the ID
        callbacksRef.current.onSelectedRequestUpdated?.(payload.id, payload);
      }),
      
      webSocketHook.on('request_deleted', (event) => {
        const payload = event.payload as { id: number };
        callbacksRef.current.onRequestDeleted?.(payload.id);
      }),
    ];

    return cleanupHandlers;
  }, [webSocketHook, maxReconnectAttempts, reconnectDelayMs]);

  useEffect(() => {
    if (!enabled) {
      if (wsConnectedRef.current) {
        webSocketHook.disconnect();
        wsConnectedRef.current = false;
        setStatus('disconnected');
      }
      return;
    }

    if (wsConnectedRef.current) {
      return;
    }

    const cleanupHandlers = setupEventHandlers();
    setStatus('connecting');
    webSocketHook.connect();

    return () => {
      cleanupHandlers.forEach(cleanup => cleanup());
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      if (wsConnectedRef.current) {
        webSocketHook.disconnect();
        wsConnectedRef.current = false;
        setStatus('disconnected');
      }
    };
  }, [enabled, setupEventHandlers, webSocketHook]);

  return {
    status,
    isConnected: status === 'connected',
    reconnectAttempts: reconnectAttemptsRef.current,
  };
};