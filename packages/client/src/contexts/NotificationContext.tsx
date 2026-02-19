import React, { createContext, useContext, useReducer, ReactNode } from 'react';

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  duration?: number;
  timestamp: number;
  actions?: Array<{
    label: string;
    onClick: () => void;
  }>;
}

interface NotificationState {
  notifications: Notification[];
}

interface NotificationContextType extends NotificationState {
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearAllNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

type NotificationAction =
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'REMOVE_NOTIFICATION'; payload: string }
  | { type: 'CLEAR_ALL_NOTIFICATIONS' };

const notificationReducer = (state: NotificationState, action: NotificationAction): NotificationState => {
  switch (action.type) {
    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [...state.notifications, action.payload],
      };
    case 'REMOVE_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload),
      };
    case 'CLEAR_ALL_NOTIFICATIONS':
      return {
        ...state,
        notifications: [],
      };
    default:
      return state;
  }
};

const initialState: NotificationState = {
  notifications: [],
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(notificationReducer, initialState);

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp'>): void => {
    const id = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = Date.now();
    
    const fullNotification: Notification = {
      ...notification,
      id,
      timestamp,
    };

    dispatch({ type: 'ADD_NOTIFICATION', payload: fullNotification });

    // Auto-remove notification after duration (default 5 seconds)
    const duration = notification.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => {
        dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
      }, duration);
    }
  };

  const removeNotification = (id: string): void => {
    dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
  };

  const clearAllNotifications = (): void => {
    dispatch({ type: 'CLEAR_ALL_NOTIFICATIONS' });
  };

  const value: NotificationContextType = {
    ...state,
    addNotification,
    removeNotification,
    clearAllNotifications,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

// Convenience functions for common notification types
export const useNotificationHelpers = () => {
  const { addNotification } = useNotifications();

  const showInfo = (title: string, message?: string, duration?: number) => {
    addNotification({ type: 'info', title, message, duration });
  };

  const showSuccess = (title: string, message?: string, duration?: number) => {
    addNotification({ type: 'success', title, message, duration });
  };

  const showWarning = (title: string, message?: string, duration?: number) => {
    addNotification({ type: 'warning', title, message, duration });
  };

  const showError = (title: string, message?: string, duration?: number) => {
    addNotification({ type: 'error', title, message, duration });
  };

  const showIncomingCall = (callerName: string, callType: 'audio' | 'video', onAccept: () => void, onReject: () => void) => {
    addNotification({
      type: 'info',
      title: `Incoming ${callType} call`,
      message: `${callerName} is calling you`,
      duration: 0, // Don't auto-remove
      actions: [
        { label: 'Accept', onClick: onAccept },
        { label: 'Reject', onClick: onReject },
      ],
    });
  };

  const showMessage = (senderName: string, message: string, onOpen: () => void) => {
    addNotification({
      type: 'info',
      title: `New message from ${senderName}`,
      message: message.length > 50 ? message.substring(0, 50) + '...' : message,
      duration: 5000,
      actions: [
        { label: 'Open', onClick: onOpen },
      ],
    });
  };

  return {
    showInfo,
    showSuccess,
    showWarning,
    showError,
    showIncomingCall,
    showMessage,
  };
};
