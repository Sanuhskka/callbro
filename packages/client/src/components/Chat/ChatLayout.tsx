import React, { useState } from 'react';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Avatar,
  Badge,
  IconButton,
  Toolbar,
  AppBar,
  Divider,
} from '@mui/material';
import {
  MessageSquare,
  Phone,
  Video,
  Settings,
  LogOut,
  Circle,
  Menu,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useWebRTC } from '../../contexts/WebRTCContext';
import { useNotificationHelpers } from '../../contexts/NotificationContext';

const DRAWER_WIDTH = 320;
const MOBILE_BREAKPOINT = 600;
const TABLET_BREAKPOINT = 900;

interface Contact {
  id: string;
  username: string;
  isOnline: boolean;
  unreadCount: number;
  lastMessage?: string;
  lastMessageTime?: string;
}

const ChatLayout: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [contacts] = useState<Contact[]>([
    {
      id: '1',
      username: 'Alice Johnson',
      isOnline: true,
      unreadCount: 2,
      lastMessage: 'Hey! How are you?',
      lastMessageTime: '2:30 PM',
    },
    {
      id: '2',
      username: 'Bob Smith',
      isOnline: false,
      unreadCount: 0,
      lastMessage: 'See you tomorrow!',
      lastMessageTime: 'Yesterday',
    },
    {
      id: '3',
      username: 'Carol Davis',
      isOnline: true,
      unreadCount: 1,
      lastMessage: 'Can you help me with something?',
      lastMessageTime: '1:15 PM',
    },
  ]);

  const { user, logout } = useAuth();
  const { incomingCall, answerCall, rejectCall } = useWebRTC();
  const { showIncomingCall } = useNotificationHelpers();
  const navigate = useNavigate();
  const { userId } = useParams();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleContactClick = (contactId: string) => {
    navigate(`/chat/${contactId}`);
    if (window.innerWidth < TABLET_BREAKPOINT) {
      setMobileOpen(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleVoiceCall = (contactId: string) => {
    navigate(`/call/${contactId}`);
  };

  const handleVideoCall = (contactId: string) => {
    navigate(`/call/${contactId}`);
  };

  // Handle incoming call
  React.useEffect(() => {
    if (incomingCall) {
      const contact = contacts.find(c => c.id === incomingCall.userId);
      const callerName = contact?.username || `User ${incomingCall.userId}`;

      showIncomingCall(
        callerName,
        incomingCall.callType,
        () => answerCall(incomingCall.callId, incomingCall.callType),
        () => rejectCall(incomingCall.callId)
      );
    }
  }, [incomingCall, contacts, answerCall, rejectCall, showIncomingCall]);

  const drawer = (
    <Box>
      <Toolbar>
        <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 'bold' }}>
          Secure Messenger
        </Typography>
      </Toolbar>
      <Divider />
      <List sx={{ px: 1 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ px: 2, py: 1 }}>
          Messages
        </Typography>
        {contacts.map((contact) => (
          <ListItem key={contact.id} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              onClick={() => handleContactClick(contact.id)}
              selected={userId === contact.id}
              sx={{
                borderRadius: 2,
                '&.Mui-selected': {
                  backgroundColor: 'rgba(25, 118, 210, 0.1)',
                  '&:hover': {
                    backgroundColor: 'rgba(25, 118, 210, 0.15)',
                  },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 48 }}>
                <Badge
                  overlap="circular"
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  badgeContent={
                    <Circle
                      size={12}
                      fill={contact.isOnline ? '#4caf50' : '#9e9e9e'}
                      color={contact.isOnline ? '#4caf50' : '#9e9e9e'}
                    />
                  }
                >
                  <Avatar sx={{ width: 40, height: 40, bgcolor: 'primary.main' }}>
                    {contact.username.charAt(0).toUpperCase()}
                  </Avatar>
                </Badge>
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'medium' }}>
                      {contact.username}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {contact.lastMessageTime}
                    </Typography>
                  </Box>
                }
                secondary={
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: { xs: '120px', sm: '150px', md: '180px' },
                      }}
                    >
                      {contact.lastMessage}
                    </Typography>
                    <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 0.5 }}>
                      <IconButton
                        size="small"
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          handleVoiceCall(contact.id);
                        }}
                        sx={{ p: 0.5 }}
                      >
                        <Phone size={16} />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          handleVideoCall(contact.id);
                        }}
                        sx={{ p: 0.5 }}
                      >
                        <Video size={16} />
                      </IconButton>
                    </Box>
                  </Box>
                }
              />
              {contact.unreadCount > 0 && (
                <Badge
                  badgeContent={contact.unreadCount}
                  color="primary"
                  sx={{ ml: 1 }}
                />
              )}
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider sx={{ my: 2 }} />
      <List sx={{ px: 1 }}>
        <ListItem disablePadding>
          <ListItemButton sx={{ borderRadius: 2 }}>
            <ListItemIcon>
              <Settings size={20} />
            </ListItemIcon>
            <ListItemText primary="Settings" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton onClick={handleLogout} sx={{ borderRadius: 2 }}>
            <ListItemIcon>
              <LogOut size={20} />
            </ListItemIcon>
            <ListItemText primary="Logout" />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { xs: '100%', sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { sm: `${DRAWER_WIDTH}px` },
          bgcolor: 'background.paper',
          color: 'text.primary',
          boxShadow: 1,
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }}>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <Menu />
          </IconButton>
          <Typography 
            variant="h6" 
            noWrap 
            component="div" 
            sx={{ 
              flexGrow: 1,
              fontSize: { xs: '1rem', sm: '1.25rem' },
            }}
          >
            {user?.username ? `Welcome, ${user.username}` : 'Secure Messenger'}
          </Typography>
          <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1 }}>
            <MessageSquare size={20} />
            <Typography variant="body2" color="text.secondary">
              End-to-end encrypted
            </Typography>
          </Box>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { sm: DRAWER_WIDTH }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: DRAWER_WIDTH,
              bgcolor: 'background.paper',
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: DRAWER_WIDTH,
              bgcolor: 'background.paper',
              borderRight: '1px solid rgba(255, 255, 255, 0.12)',
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.default',
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
};

export default ChatLayout;
