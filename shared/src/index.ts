// Unified communication library - main entry point

// Types
export * from './types/index';

// Configuration
export * from './config/index';

// API Client
export * from './api/client';

// WebSocket Manager
export * from './websocket/manager';

// Re-export commonly used items for convenience
export type {
  RequestStatus,
  AnalysisRequest,
  RequestSummary,
  WebSocketStatusUpdate,
  AdminUser,
  AppSettings,
  CommunicationEvent,
  CommunicationEventType,
} from './types/index';

export {
  createCommunicationConfig,
  getEnvironmentConfig,
} from './config/index';

export {
  UnifiedApiClient,
  createApiClient,
} from './api/client';

export {
  UnifiedWebSocketManager,
  createWebSocketManager,
  createWebSocketHook,
} from './websocket/manager';