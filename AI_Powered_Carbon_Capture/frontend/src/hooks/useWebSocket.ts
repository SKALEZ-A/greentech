import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './useAuth';

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

export interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  lastMessage: WebSocketMessage | null;
  error: string | null;
  reconnectAttempts: number;
}

export interface WebSocketOptions {
  url?: string;
  protocols?: string | string[];
  shouldReconnect?: boolean;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export interface WebSocketReturn extends WebSocketState {
  send: (message: any) => void;
  subscribe: (eventType: string, callback: (data: any) => void) => () => void;
  unsubscribe: (eventType: string, callback?: (data: any) => void) => void;
  connect: () => void;
  disconnect: () => void;
}

/**
 * Custom hook for WebSocket connections with auto-reconnect and event handling
 * @param options - WebSocket configuration options
 * @returns WebSocket state and control functions
 */
export function useWebSocket(options: WebSocketOptions = {}): WebSocketReturn {
  const {
    url: providedUrl,
    protocols,
    shouldReconnect = true,
    reconnectAttempts: initialReconnectAttempts = 0,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
  } = options;

  const { token, isAuthenticated } = useAuth();

  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    isConnecting: false,
    lastMessage: null,
    error: null,
    reconnectAttempts: initialReconnectAttempts,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const eventListenersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());
  const reconnectAttemptsRef = useRef(initialReconnectAttempts);

  // Build WebSocket URL
  const getWebSocketUrl = useCallback(() => {
    if (providedUrl) return providedUrl;

    const baseUrl = process.env.NEXT_PUBLIC_WS_URL ||
                   (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000')
                     .replace(/^http/, 'ws');

    return token ? `${baseUrl}?token=${token}` : baseUrl;
  }, [providedUrl, token]);

  // Update state
  const updateState = useCallback((updates: Partial<WebSocketState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Handle incoming messages
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);

      // Update last message
      updateState({ lastMessage: message });

      // Notify event listeners
      const listeners = eventListenersRef.current.get(message.type);
      if (listeners) {
        listeners.forEach(callback => {
          try {
            callback(message.data);
          } catch (error) {
            console.error('WebSocket event listener error:', error);
          }
        });
      }

    } catch (error) {
      console.error('WebSocket message parsing error:', error);
      updateState({ error: 'Failed to parse message' });
    }
  }, [updateState]);

  // Handle WebSocket open
  const handleOpen = useCallback(() => {
    console.log('WebSocket connected');
    updateState({
      isConnected: true,
      isConnecting: false,
      error: null,
      reconnectAttempts: 0,
    });
    reconnectAttemptsRef.current = 0;
  }, [updateState]);

  // Handle WebSocket close
  const handleClose = useCallback((event: CloseEvent) => {
    console.log('WebSocket disconnected:', event.code, event.reason);
    updateState({
      isConnected: false,
      isConnecting: false,
    });

    // Attempt reconnection if enabled
    if (shouldReconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
      reconnectAttemptsRef.current += 1;
      updateState({ reconnectAttempts: reconnectAttemptsRef.current });

      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, reconnectInterval);
    }
  }, [shouldReconnect, maxReconnectAttempts, reconnectInterval, updateState]);

  // Handle WebSocket errors
  const handleError = useCallback((event: Event) => {
    console.error('WebSocket error:', event);
    updateState({
      error: 'WebSocket connection error',
      isConnecting: false,
    });
  }, [updateState]);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    if (!isAuthenticated) {
      updateState({ error: 'Authentication required for WebSocket connection' });
      return;
    }

    updateState({ isConnecting: true, error: null });

    try {
      const wsUrl = getWebSocketUrl();
      wsRef.current = new WebSocket(wsUrl, protocols);

      wsRef.current.onopen = handleOpen;
      wsRef.current.onmessage = handleMessage;
      wsRef.current.onclose = handleClose;
      wsRef.current.onerror = handleError;

    } catch (error) {
      console.error('WebSocket connection error:', error);
      updateState({
        isConnecting: false,
        error: 'Failed to create WebSocket connection',
      });
    }
  }, [getWebSocketUrl, handleOpen, handleMessage, handleClose, handleError, isAuthenticated, protocols, updateState]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }

    updateState({
      isConnected: false,
      isConnecting: false,
      reconnectAttempts: 0,
    });
    reconnectAttemptsRef.current = 0;
  }, [updateState]);

  // Send message
  const send = useCallback((message: any) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket is not connected');
      return;
    }

    try {
      const messageString = JSON.stringify(message);
      wsRef.current.send(messageString);
    } catch (error) {
      console.error('WebSocket send error:', error);
      updateState({ error: 'Failed to send message' });
    }
  }, [updateState]);

  // Subscribe to events
  const subscribe = useCallback((eventType: string, callback: (data: any) => void) => {
    if (!eventListenersRef.current.has(eventType)) {
      eventListenersRef.current.set(eventType, new Set());
    }

    eventListenersRef.current.get(eventType)!.add(callback);

    // Return unsubscribe function
    return () => {
      unsubscribe(eventType, callback);
    };
  }, []);

  // Unsubscribe from events
  const unsubscribe = useCallback((eventType: string, callback?: (data: any) => void) => {
    const listeners = eventListenersRef.current.get(eventType);
    if (!listeners) return;

    if (callback) {
      listeners.delete(callback);
    } else {
      listeners.clear();
    }

    if (listeners.size === 0) {
      eventListenersRef.current.delete(eventType);
    }
  }, []);

  // Connect when authenticated
  useEffect(() => {
    if (isAuthenticated && !state.isConnected && !state.isConnecting) {
      connect();
    } else if (!isAuthenticated && state.isConnected) {
      disconnect();
    }
  }, [isAuthenticated, state.isConnected, state.isConnecting, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  // Handle visibility change (reconnect when tab becomes visible)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isAuthenticated && !state.isConnected) {
        connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isAuthenticated, state.isConnected, connect]);

  return {
    ...state,
    send,
    subscribe,
    unsubscribe,
    connect,
    disconnect,
  };
}

/**
 * Hook for real-time sensor data updates
 */
export function useSensorUpdates(unitId?: string) {
  const { subscribe, send } = useWebSocket();
  const [sensorData, setSensorData] = useState<any[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (!unitId) return;

    // Subscribe to sensor updates
    const unsubscribe = subscribe('sensor-data', (data) => {
      if (data.unitId === unitId) {
        setSensorData(prev => [data, ...prev.slice(0, 99)]); // Keep last 100 readings
      }
    });

    // Join unit room
    send({
      type: 'join-unit',
      unitId,
    });

    setIsSubscribed(true);

    return () => {
      // Leave unit room
      send({
        type: 'leave-unit',
        unitId,
      });
      unsubscribe();
      setIsSubscribed(false);
    };
  }, [unitId, subscribe, send]);

  return {
    sensorData,
    isSubscribed,
    clearData: () => setSensorData([]),
  };
}

/**
 * Hook for real-time AI optimization updates
 */
export function useAIOptimizations(unitId?: string) {
  const { subscribe, send } = useWebSocket();
  const [optimizations, setOptimizations] = useState<any[]>([]);

  useEffect(() => {
    if (!unitId) return;

    const unsubscribe = subscribe('ai-optimization', (data) => {
      if (data.unitId === unitId) {
        setOptimizations(prev => [data, ...prev.slice(0, 49)]); // Keep last 50 optimizations
      }
    });

    // Join unit room
    send({
      type: 'join-unit',
      unitId,
    });

    return () => {
      send({
        type: 'leave-unit',
        unitId,
      });
      unsubscribe();
    };
  }, [unitId, subscribe, send]);

  return {
    optimizations,
    clearOptimizations: () => setOptimizations([]),
  };
}

/**
 * Hook for real-time system alerts
 */
export function useSystemAlerts() {
  const { subscribe } = useWebSocket();
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = subscribe('system-alert', (alert) => {
      setAlerts(prev => [alert, ...prev.slice(0, 19)]); // Keep last 20 alerts
    });

    return unsubscribe;
  }, [subscribe]);

  return {
    alerts,
    clearAlerts: () => setAlerts([]),
    markAsRead: (alertId: string) => {
      setAlerts(prev => prev.map(alert =>
        alert.id === alertId ? { ...alert, read: true } : alert
      ));
    },
  };
}

/**
 * Hook for real-time carbon credit updates
 */
export function useCreditUpdates(userId?: string) {
  const { subscribe } = useWebSocket();
  const [creditUpdates, setCreditUpdates] = useState<any[]>([]);

  useEffect(() => {
    if (!userId) return;

    const unsubscribe = subscribe('credit-update', (data) => {
      if (data.userId === userId) {
        setCreditUpdates(prev => [data, ...prev.slice(0, 29)]); // Keep last 30 updates
      }
    });

    return unsubscribe;
  }, [userId, subscribe]);

  return {
    creditUpdates,
    clearUpdates: () => setCreditUpdates([]),
  };
}
