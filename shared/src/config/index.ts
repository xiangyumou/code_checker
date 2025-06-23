// Unified configuration management for communication

export interface CommunicationConfig {
  api: {
    baseURL: string;
    timeout: number;
    retryAttempts: number;
  };
  websocket: {
    url: string;
    reconnectInterval: number;
    maxReconnectAttempts: number;
  };
  client: {
    type: 'frontend' | 'admin';
    id: string;
  };
}

// Default configuration values
const DEFAULT_CONFIG: Omit<CommunicationConfig, 'client'> = {
  api: {
    baseURL: '/api/v1',
    timeout: 10000,
    retryAttempts: 3,
  },
  websocket: {
    url: `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/status`,
    reconnectInterval: 5000,
    maxReconnectAttempts: 5,
  },
};

// Configuration factory
export function createCommunicationConfig(
  clientType: 'frontend' | 'admin',
  overrides: Partial<CommunicationConfig> = {}
): CommunicationConfig {
  // Generate a simple random ID (UUID would be better but requires additional dependency)
  const clientId = `${clientType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Admin-specific defaults
  const adminOverrides = clientType === 'admin' ? {
    api: {
      ...DEFAULT_CONFIG.api,
      timeout: 15000, // Longer timeout for admin operations
    },
  } : {};

  return {
    ...DEFAULT_CONFIG,
    ...adminOverrides,
    ...overrides,
    client: {
      type: clientType,
      id: clientId,
    },
  };
}

// Environment-based configuration
export function getEnvironmentConfig(): Partial<CommunicationConfig> {
  const config: Partial<CommunicationConfig> = {};
  
  // Check if we're in a Vite environment
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    // API configuration from environment
    if (import.meta.env.VITE_API_BASE_URL) {
      config.api = {
        ...DEFAULT_CONFIG.api,
        baseURL: import.meta.env.VITE_API_BASE_URL,
      };
    }
    
    // WebSocket configuration from environment
    if (import.meta.env.VITE_WS_URL) {
      config.websocket = {
        ...DEFAULT_CONFIG.websocket,
        url: import.meta.env.VITE_WS_URL,
      };
    }
  }
  
  return config;
}