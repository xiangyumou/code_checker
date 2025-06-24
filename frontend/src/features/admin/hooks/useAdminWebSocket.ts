import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import { useUnifiedWebSocket } from '@/hooks/useUnifiedWebSocket';
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
  const { message } = App.useApp();

  const { status, isConnected, reconnectAttempts } = useUnifiedWebSocket({
    enabled: true,
    onRequestCreated,
    onRequestUpdated,
    onRequestDeleted,
    onSelectedRequestUpdated,
    onConnectionEstablished: () => {
      message.success(t('adminLayout.websocketConnected'));
    },
    onConnectionLost: () => {
      if (reconnectAttempts >= 5) {
        message.error(t('adminLayout.websocketReconnectFailed'));
      }
    },
    maxReconnectAttempts: 5,
    reconnectDelayMs: 3000,
  });

  return { status, isConnected, reconnectAttempts };
};