import React from 'react';
import {
  Box,
  Snackbar,
  Alert,
  Button,
  Slide,
} from '@mui/material';
import { CheckCircle, AlertTriangle, Info, AlertCircle, X } from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';

interface NotificationItemProps {
  notification: {
    id: string;
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message?: string;
    actions?: Array<{
      label: string;
      onClick: () => void;
    }>;
  };
  onClose: (id: string) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onClose }) => {
  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return <CheckCircle size={20} />;
      case 'warning':
        return <AlertTriangle size={20} />;
      case 'error':
        return <AlertCircle size={20} />;
      case 'info':
      default:
        return <Info size={20} />;
    }
  };

  const getSeverity = () => {
    switch (notification.type) {
      case 'success':
        return 'success';
      case 'warning':
        return 'warning';
      case 'error':
        return 'error';
      case 'info':
      default:
        return 'info';
    }
  };

  return (
    <Alert
      severity={getSeverity() as any}
      icon={getIcon()}
      action={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {notification.actions?.map((action, index) => (
            <Button
              key={index}
              size="small"
              onClick={() => {
                action.onClick();
                onClose(notification.id);
              }}
              sx={{ color: 'inherit' }}
            >
              {action.label}
            </Button>
          ))}
          <Button
            size="small"
            onClick={() => onClose(notification.id)}
            sx={{ minWidth: 'auto', p: 0.5, color: 'inherit' }}
          >
            <X size={16} />
          </Button>
        </Box>
      }
      sx={{
        minWidth: 300,
        maxWidth: 500,
        '& .MuiAlert-message': {
          flex: 1,
        },
      }}
    >
      <Box sx={{ fontWeight: 'bold' }}>{notification.title}</Box>
      {notification.message}
    </Alert>
  );
};

const SlideTransition = (props: any) => {
  return <Slide {...props} direction="down" />;
};

const NotificationContainer: React.FC = () => {
  const { notifications, removeNotification } = useNotifications();

  const handleClose = (id: string) => {
    removeNotification(id);
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 20,
        right: 20,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        pointerEvents: 'none',
      }}
    >
      {notifications.map((notification) => (
        <Snackbar
          key={notification.id}
          open={true}
          TransitionComponent={SlideTransition}
          sx={{
            pointerEvents: 'auto',
          }}
        >
          <NotificationItem
            notification={notification}
            onClose={handleClose}
          />
        </Snackbar>
      ))}
    </Box>
  );
};

export default NotificationContainer;
