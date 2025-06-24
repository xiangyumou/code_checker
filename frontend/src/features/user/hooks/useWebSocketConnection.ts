import { useUnifiedWebSocket } from '@/hooks/useUnifiedWebSocket';
import type { RequestSummary } from '../../../types/index';

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
  const { status } = useUnifiedWebSocket({
    enabled: isInitialized === true,
    onRequestCreated,
    onRequestUpdated,
    onRequestDeleted,
    onSelectedRequestUpdated: (requestId) => {
      // User version only needs the ID, not the partial update
      onSelectedRequestUpdated(requestId);
    },
    maxReconnectAttempts: 5,
    reconnectDelayMs: 3000,
  });

  return { wsStatus: status };
};