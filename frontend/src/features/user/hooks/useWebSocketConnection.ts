import { useState, useEffect, useRef, useCallback } from 'react';
import { useWebSocket } from '@/api/centralized';
import type { RequestSummary } from '../../../types/index';

type WebSocketConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseWebSocketConnectionProps {
  isInitialized: boolean | null;
  onRequestCreated: (request: RequestSummary) => void;
  onRequestUpdated: (update: Partial<RequestSummary> & { id: number }) => void;
  onRequestDeleted: (deletedId: number) => void;
  onSelectedRequestUpdated: (requestId: number) => void;
}

export const useWebSocketConnection = ({
  isInitialized,
  onRequestCreated,
  onRequestUpdated,
  onRequestDeleted,
  onSelectedRequestUpdated,
}: UseWebSocketConnectionProps) => {
  const [wsStatus, setWsStatus] = useState<WebSocketConnectionStatus>('disconnected');
  const webSocketHook = useWebSocket;
  const wsConnectedRef = useRef(false);

  const setupEventHandlers = useCallback(() => {
    const cleanupHandlers = [
      webSocketHook.on('connection_established', () => {
        setWsStatus('connected');
        wsConnectedRef.current = true;
      }),
      
      webSocketHook.on('connection_lost', () => {
        setWsStatus('disconnected');
        wsConnectedRef.current = false;
      }),
      
      webSocketHook.on('error', () => {
        setWsStatus('error');
      }),

      webSocketHook.on('request_created', (event) => {
        const newRequestSummary = event.payload as RequestSummary;
        onRequestCreated(newRequestSummary);
      }),
      
      webSocketHook.on('request_updated', (event) => {
        const updatedSummary = event.payload as Partial<RequestSummary> & { id: number };
        onRequestUpdated(updatedSummary);
        onSelectedRequestUpdated(updatedSummary.id);
      }),
      
      webSocketHook.on('request_deleted', (event) => {
        const deletedId = event.payload.id;
        onRequestDeleted(deletedId);
      }),
    ];

    return cleanupHandlers;
  }, [webSocketHook, onRequestCreated, onRequestUpdated, onRequestDeleted, onSelectedRequestUpdated]);

  useEffect(() => {
    if (isInitialized !== true) {
      if (wsConnectedRef.current) {
        webSocketHook.disconnect();
        wsConnectedRef.current = false;
      }
      return;
    }

    const connectWebSocket = () => {
      if (wsConnectedRef.current) {
        return;
      }
      
      const cleanupHandlers = setupEventHandlers();
      webSocketHook.connect();
      
      return cleanupHandlers;
    };

    const cleanupHandlers = connectWebSocket();

    return () => {
      if (wsConnectedRef.current) {
        webSocketHook.disconnect();
        wsConnectedRef.current = false;
      }
      
      if (cleanupHandlers) {
        cleanupHandlers.forEach(cleanup => {
          if (typeof cleanup === 'function') {
            cleanup();
          }
        });
      }
    };
  }, [isInitialized, setupEventHandlers, webSocketHook]);

  return { wsStatus };
};