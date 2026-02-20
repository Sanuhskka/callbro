import React from 'react';
import { Card as MuiCard, CardContent } from '@mui/material';
import type { SxProps, Theme } from '@mui/system';

interface CustomCardProps {
  children?: React.ReactNode;
  title?: string;
  subtitle?: string;
  image?: string;
  actions?: React.ReactNode;
  elevation?: number;
  variant?: 'elevation' | 'outlined';
  sx?: SxProps<Theme>;
}

const CustomCard: React.FC<CustomCardProps> = ({
  children,
  elevation = 2,
  variant = 'elevation',
  sx,
  ...props
}) => {
  return (
    <MuiCard
      elevation={elevation}
      variant={variant}
      sx={{
        borderRadius: 2,
        transition: 'all 0.3s ease',
        '&:hover': {
          elevation: 4,
          transform: 'translateY(-2px)',
        },
        ...sx,
      }}
      {...props}
    >
      {children && (
        <CardContent
          sx={{
            '&:last-child': {
              paddingBottom: 16,
            },
          }}
        >
          {children}
        </CardContent>
      )}
    </MuiCard>
  );
};

export default CustomCard;
