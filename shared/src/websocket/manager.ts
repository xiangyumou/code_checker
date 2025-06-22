import { CommunicationConfig } from '../config/index';
import { CommunicationEvent, CommunicationEventType } from '../types/index';

export type WebSocketEventHandler = (event: CommunicationEvent) => void;

export interface WebSocketManagerOptions {
  url: string;
  clientId: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

export class UnifiedWebSocketManager {
  private ws: WebSocket | null = null;
  private eventHandlers: Map<CommunicationEventType, WebSocketEventHandler[]> = new Map();
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isManualClose = false;
  private options: Required<WebSocketManagerOptions>;

  constructor(options: WebSocketManagerOptions) {
    this.options = {
      reconnectInterval: 5000,
      maxReconnectAttempts: 5,
      onConnect: () => {},
      onDisconnect: () => {},
      onError: () => {},
      ...options,
    };
  }

  // Connect to WebSocket
  public connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    this.isManualClose = false;
    const wsUrl = `${this.options.url}/${this.options.clientId}`;
    
    try {
      this.ws = new WebSocket(wsUrl);
      this.setupEventListeners();
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.scheduleReconnect();
    }
  }

  // Disconnect from WebSocket
  public disconnect(): void {
    this.isManualClose = true;
    this.clearReconnectTimer();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // Add event handler
  public on(eventType: CommunicationEventType, handler: WebSocketEventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }

  // Remove event handler
  public off(eventType: CommunicationEventType, handler: WebSocketEventHandler): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  // Send message
  public send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected. Message not sent:', message);
    }
  }

  // Get connection status
  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private setupEventListeners(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('WebSocket connected:', this.options.clientId);
      this.reconnectAttempts = 0;
      this.options.onConnect();
      this.emit('connection_established', {});
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason);
      this.options.onDisconnect();
      this.emit('connection_lost', { code: event.code, reason: event.reason });
      
      if (!this.isManualClose) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.options.onError(error);
      this.emit('error', { error: error.toString() });
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error, event.data);
      }
    };
  }

  private handleMessage(data: any): void {
    // Handle different message formats
    let eventType: CommunicationEventType;
    let payload: any;

    if (data.type) {
      // New unified format
      eventType = data.type;
      payload = data.payload || data;
    } else {
      // Legacy format handling
      if (data.request_id !== undefined) {
        eventType = 'request_updated';
        payload = data;
      } else {
        eventType = 'status_update';
        payload = data;
      }
    }

    this.emit(eventType, payload);
  }

  private emit(eventType: CommunicationEventType, payload: any): void {
    const event: CommunicationEvent = {
      type: eventType,
      payload,
      timestamp: new Date().toISOString(),
    };

    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error('Error in WebSocket event handler:', error);
        }
      });
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.options.maxReconnectAttempts})`);
      this.connect();
    }, this.options.reconnectInterval);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

// Factory function to create WebSocket manager
export function createWebSocketManager(
  communicationConfig: CommunicationConfig,
  options: {
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: Event) => void;
  } = {}
): UnifiedWebSocketManager {
  return new UnifiedWebSocketManager({
    url: communicationConfig.websocket.url,
    clientId: communicationConfig.client.id,
    reconnectInterval: communicationConfig.websocket.reconnectInterval,
    maxReconnectAttempts: communicationConfig.websocket.maxReconnectAttempts,
    ...options,
  });
}

// Simplified WebSocket hook for React components
export function createWebSocketHook(manager: UnifiedWebSocketManager) {
  return {
    connect: () => manager.connect(),
    disconnect: () => manager.disconnect(),
    on: (eventType: CommunicationEventType, handler: WebSocketEventHandler) => {
      manager.on(eventType, handler);
      return () => manager.off(eventType, handler); // Return cleanup function
    },
    send: (message: any) => manager.send(message),
    isConnected: () => manager.isConnected(),
  };
}