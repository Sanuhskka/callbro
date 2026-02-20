import React from 'react';
import Button from '@mui/material/Button';
import { CircularProgress } from '@mui/material';

interface LoadingButtonProps {
  children?: React.ReactNode;
  loading?: boolean;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  disabled?: boolean;
  sx?: object;
  fullWidth?: boolean;
  variant?: 'text' | 'outlined' | 'contained';
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit' | 'reset';
}

const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  ({ 
    children, 
    loading = false, 
    startIcon, 
    endIcon, 
    disabled,
    sx,
    ...props 
  }, ref) => {
  return (
    <Button
      ref={ref}
      disabled={disabled || loading}
      startIcon={loading ? <CircularProgress size={16} /> : startIcon}
      endIcon={endIcon}
      sx={{
        minWidth: 120,
        minHeight: 40,
        position: 'relative',
        transition: 'all 0.2s ease',
        '&:hover:not(:disabled)': {
          transform: 'translateY(-1px)',
        },
        '&:active:not(:disabled)': {
          transform: 'translateY(0)',
        },
        ...sx,
      }}
      {...props}
    >
      {children}
    </Button>
  );
  }
);

LoadingButton.displayName = 'LoadingButton';

export default LoadingButton;
