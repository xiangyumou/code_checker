import { useState, useEffect, useRef } from 'react';
import { useWebSocket as centralizedWebSocket } from '@/api/centralized';
import type { CommunicationEvent, CommunicationEventType } from '@shared/types';

const DATA_EVENTS: CommunicationEventType[] = [
  'request_created',
  'request_updated',
  'request_deleted',
  'status_update',
];

export const useWebSocket = () => {
  const [isConnected, setIsConnected] = useState(() => centralizedWebSocket.isConnected());
  const [lastMessage, setLastMessage] = useState<CommunicationEvent | null>(null);
  const cleanupHandlersRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    const handleConnectionEstablished = (_event: CommunicationEvent) => {
      setIsConnected(true);
    };

    const handleConnectionLost = (_event: CommunicationEvent) => {
      setIsConnected(false);
    };

    const handleError = (_event: CommunicationEvent) => {
      setIsConnected(false);
    };

    const handleDataEvent = (event: CommunicationEvent) => {
      // Ensure payload is propagated following the server message format
      setLastMessage({
        ...event,
        payload: event.payload ?? null,
      });
    };

    const handlers: Array<() => void> = [
      centralizedWebSocket.on('connection_established', handleConnectionEstablished),
      centralizedWebSocket.on('connection_lost', handleConnectionLost),
      centralizedWebSocket.on('error', handleError),
      ...DATA_EVENTS.map(eventType => centralizedWebSocket.on(eventType, handleDataEvent)),
    ];

    cleanupHandlersRef.current = handlers;
    centralizedWebSocket.connect();

    return () => {
      cleanupHandlersRef.current.forEach(unsubscribe => {
        try {
          unsubscribe();
        } catch (error) {
          console.error('Failed to remove WebSocket handler', error);
        }
      });
      cleanupHandlersRef.current = [];
      centralizedWebSocket.disconnect();
    };
  }, []);

  return {
    isConnected,
    lastMessage,
  };
};