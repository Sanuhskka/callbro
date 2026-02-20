import React from 'react';
import { Box } from '@mui/material';
import { useTheme } from '@mui/system';
import useMediaQuery from '@mui/material/useMediaQuery';
import type { SxProps, Theme } from '@mui/system';

interface ResponsiveLayoutProps {
  children: React.ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  centerContent?: boolean;
  sx?: SxProps<Theme>;
}

const ResponsiveLayout: React.FC<ResponsiveLayoutProps> = ({
  children,
  maxWidth = 'lg',
  centerContent = false,
  sx,
}) => {
  const theme = useTheme();
  
  // Breakpoint values
  const breakpointValues = {
    xs: 0,
    sm: 600,
    md: 900,
    lg: 1200,
    xl: 1536,
  };

  // Media queries
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  // Get max width based on prop
  const getMaxWidth = () => {
    switch (maxWidth) {
      case 'xs':
        return {
          maxWidth: 444, // 600 - 156 (sidebar width)
          mx: 'auto',
        };
      case 'sm':
        return {
          maxWidth: 744, // 900 - 156
          mx: 'auto',
        };
      case 'md':
        return {
          maxWidth: 1044, // 1200 - 156
          mx: 'auto',
        };
      case 'lg':
        return {
          maxWidth: 1376, // 1536 - 160
          mx: 'auto',
        };
      case 'xl':
        return {
          maxWidth: '100%',
          mx: 'auto',
        };
      default:
        return {
          maxWidth: 1044,
          mx: 'auto',
        };
    }
  };

  const containerSx = {
    ...getMaxWidth(),
    width: '100%',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    ...(centerContent && {
      alignItems: 'center',
      justifyContent: 'center',
    }),
    ...sx,
  };

  return (
    <Box sx={containerSx}>
      {children}
    </Box>
  );
};

export default ResponsiveLayout;
