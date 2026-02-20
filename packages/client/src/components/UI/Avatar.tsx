import React from 'react';
import {
  Avatar as MuiAvatar,
  Box,
  Typography,
  CircularProgress,
} from '@mui/material';
import { User } from 'lucide-react';
import type { AvatarProps } from '@mui/material/Avatar';

interface CustomAvatarProps extends Omit<AvatarProps, 'src'> {
  src?: string;
  alt?: string;
  name?: string;
  size?: number | string;
  showStatus?: boolean;
  statusColor?: string;
  statusPosition?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  loading?: boolean;
  fallbackIcon?: React.ReactNode;
}

const CustomAvatar: React.FC<CustomAvatarProps> = ({
  src,
  alt,
  name,
  size = 40,
  showStatus = false,
  statusColor = '#4caf50',
  statusPosition = 'bottom-right',
  loading = false,
  fallbackIcon,
  sx,
  ...props
}) => {
  // Get initials from name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Get status position styles
  const getStatusPosition = () => {
    const positions = {
      'bottom-right': {
        bottom: 0,
        right: 0,
      },
      'bottom-left': {
        bottom: 0,
        left: 0,
      },
      'top-right': {
        top: 0,
        right: 0,
      },
      'top-left': {
        top: 0,
        left: 0,
      },
    };
    return positions[statusPosition] || positions['bottom-right'];
  };

  const avatarSize = typeof size === 'number' ? size : 40;
  const statusSize = avatarSize * 0.3;

  return (
    <Box
      sx={{
        position: 'relative',
        display: 'inline-flex',
        width: avatarSize,
        height: avatarSize,
      }}
    >
      <MuiAvatar
        src={src}
        alt={alt}
        sx={{
          width: avatarSize,
          height: avatarSize,
          bgcolor: 'primary.main',
          fontSize: avatarSize * 0.4,
          fontWeight: 600,
          ...sx,
        }}
        {...props}
      >
        {loading ? (
          <CircularProgress size={avatarSize * 0.6} />
        ) : src ? null : name ? (
          getInitials(name)
        ) : fallbackIcon ? (
          fallbackIcon
        ) : (
          <User size={avatarSize * 0.6} />
        )}
      </MuiAvatar>

      {showStatus && (
        <Box
          sx={{
            position: 'absolute',
            width: statusSize,
            height: statusSize,
            borderRadius: '50%',
            backgroundColor: statusColor,
            border: '2px solid',
            borderColor: 'background.paper',
            ...getStatusPosition(),
          }}
        />
      )}
    </Box>
  );
};

export default CustomAvatar;
