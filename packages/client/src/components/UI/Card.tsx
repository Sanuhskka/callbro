import React from 'react';
import {
  Card as MuiCard,
  CardContent,
  CardActions,
  CardHeader,
  CardMedia,
  SxProps,
  Theme,
} from '@mui/material';

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
  title,
  subtitle,
  image,
  actions,
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
      {image && (
        <CardMedia
          component="img"
          height="140"
          image={image}
          alt={title}
        />
      )}
      
      {(title || subtitle) && (
        <CardHeader
          title={title}
          subheader={subtitle}
          sx={{
            '& .MuiCardHeader-title': {
              fontSize: '1.25rem',
              fontWeight: 600,
            },
            '& .MuiCardHeader-subheader': {
              fontSize: '0.875rem',
              color: 'text.secondary',
            },
          }}
        />
      )}
      
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
      
      {actions && (
        <CardActions sx={{ justifyContent: 'flex-end', p: 2 }}>
          {actions}
        </CardActions>
      )}
    </MuiCard>
  );
};

export default CustomCard;
