import { useEffect, useRef } from 'react';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useWebSocket } from '../lib/communication';
import type { RequestSummary, AnalysisRequest } from '../../../types/index';

interface UseAdminWebSocketProps {
  onRequestCreated: (request: RequestSummary) => void;
  onRequestUpdated: (update: Partial<RequestSummary> & { id: number }) => void;
  onRequestDeleted: (deletedId: number) => void;
  onSelectedRequestUpdated: (requestId: number, partialUpdate: Partial<AnalysisRequest>) => void;
}

export const useAdminWebSocket = ({
  onRequestCreated,
  onRequestUpdated,
  onRequestDeleted,
  onSelectedRequestUpdated,
}: UseAdminWebSocketProps) => {
  const { t } = useTranslation();
  const webSocketHook = useWebSocket;
  const wsConnectedRef = useRef(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelayMs = 3000;

  useEffect(() => {
    if (wsConnectedRef.current) {
      return;
    }

    const cleanupHandlers = [
      webSocketHook.on('connection_established', () => {
        message.success(t('adminLayout.websocketConnected'));
        wsConnectedRef.current = true;
        reconnectAttemptsRef.current = 0;
      }),
      
      webSocketHook.on('connection_lost', () => {
        wsConnectedRef.current = false;
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = reconnectDelayMs * Math.pow(2, reconnectAttemptsRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current += 1;
            webSocketHook.connect();
          }, delay);
        } else {
          message.error(t('adminLayout.websocketReconnectFailed'));
        }
      }),

      webSocketHook.on('request_created', (event) => {
        const payload = event.payload as RequestSummary;
        onRequestCreated(payload);
      }),

      webSocketHook.on('request_updated', (event) => {
        const payload = event.payload as Partial<RequestSummary> & { id: number };
        onRequestUpdated(payload);
        onSelectedRequestUpdated(payload.id, payload);
      }),

      webSocketHook.on('request_deleted', (event) => {
        const payload = event.payload as { id: number };
        onRequestDeleted(payload.id);
      })
    ];

    webSocketHook.connect();

    return () => {
      cleanupHandlers.forEach(cleanup => cleanup());
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      webSocketHook.disconnect();
      wsConnectedRef.current = false;
    };
  }, [webSocketHook, onRequestCreated, onRequestUpdated, onRequestDeleted, onSelectedRequestUpdated, t]);

  return null;
};