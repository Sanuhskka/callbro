import React, { useState, useEffect } from 'react';
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
  CircularProgress,
} from '@mui/material';
import { useTheme } from '@mui/system';
import useMediaQuery from '@mui/material/useMediaQuery';
import {
  MessageSquare,
  Phone,
  Video,
  Settings,
  LogOut,
  Circle,
  Menu,
  User,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useWebRTC } from '../../contexts/WebRTCContext';
import { useNotificationHelpers } from '../../contexts/NotificationContext';

const DRAWER_WIDTH = 320;
const MOBILE_BREAKPOINT = 600;
const TABLET_BREAKPOINT = 900;

interface Contact {
  id: string;
  contactUserId: string;
  contactUsername: string;
  addedAt: string;
  nickname?: string;
  isOnline?: boolean;
  unreadCount?: number;
  lastMessage?: string;
  lastMessageTime?: string;
}

const ChatLayoutEnhanced: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));

  const { user, logout } = useAuth();
  const { incomingCall, answerCall, rejectCall } = useWebRTC();
  const { showIncomingCall } = useNotificationHelpers();
  const navigate = useNavigate();
  const { userId } = useParams();

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const token = localStorage.getItem('auth-token');
      const response = await fetch(`/api/contacts?userId=${user.id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        const formattedContacts = (data.contacts || []).map((contact: any) => ({
          ...contact,
          id: contact.contactUserId,
          unreadCount: Math.floor(Math.random() * 3),
          lastMessage: 'Последнее сообщение...',
          lastMessageTime: '2:30 PM',
        }));
        setContacts(formattedContacts);
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleContactClick = (contactId: string) => {
    navigate(`/chat/${contactId}`);
    if (isMobile) setMobileOpen(false);
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

  useEffect(() => {
    if (incomingCall) {
      const contact = contacts.find(c => c.contactUserId === incomingCall.userId);
      const callerName = contact?.contactUsername || contact?.nickname || `User ${incomingCall.userId}`;
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
      <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }}>
        <Typography variant="h6" noWrap sx={{ fontWeight: 'bold' }}>
          Secure Messenger
        </Typography>
      </Toolbar>
      <Divider />
      
      {/* Search Bar */}
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ flexGrow: 1 }}>
            <input
              type="text"
              placeholder="Поиск контактов..."
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              onFocus={() => setShowSearch(true)}
              onBlur={() => setTimeout(() => setShowSearch(false), 200)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.05)',
                color: 'white',
                fontSize: '14px',
              }}
            />
          </Box>
          <IconButton size="small">
            <User size={20} />
          </IconButton>
        </Box>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <List sx={{ px: 1 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ px: 2, py: 1 }}>
              Сообщения
            </Typography>
            {contacts.map((contact) => (
              <ListItem key={contact.id} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  onClick={() => handleContactClick(contact.contactUserId)}
                  selected={userId === contact.contactUserId}
                  sx={{
                    borderRadius: 2,
                    minHeight: 72,
                    '&.Mui-selected': {
                      backgroundColor: 'rgba(25, 118, 210, 0.1)',
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
                        {(contact.nickname || contact.contactUsername).charAt(0).toUpperCase()}
                      </Avatar>
                    </Badge>
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography variant="subtitle2" sx={{ fontWeight: 'medium' }}>
                        {contact.nickname || contact.contactUsername}
                      </Typography>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        {contact.lastMessage}
                      </Typography>
                    }
                  />
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      {contact.lastMessageTime}
                    </Typography>
                    <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 0.5 }}>
                      <IconButton
                        size="small"
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          handleVoiceCall(contact.contactUserId);
                        }}
                        sx={{ p: 0.5 }}
                      >
                        <Phone size={16} />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          handleVideoCall(contact.contactUserId);
                        }}
                        sx={{ p: 0.5 }}
                      >
                        <Video size={16} />
                      </IconButton>
                    </Box>
                  </Box>
                  {contact.unreadCount && contact.unreadCount > 0 && (
                    <Badge
                      badgeContent={contact.unreadCount}
                      color="primary"
                      sx={{ ml: 1 }}
                    />
                  )}
                </ListItemButton>
              </ListItem>
            ))}
            
            {contacts.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 4, px: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  У вас пока нет контактов
                </Typography>
              </Box>
            )}
          </List>
          <Divider sx={{ my: 2 }} />
          <List sx={{ px: 1 }}>
            <ListItem disablePadding>
              <ListItemButton sx={{ borderRadius: 2 }}>
                <ListItemIcon>
                  <Settings size={20} />
                </ListItemIcon>
                <ListItemText primary="Настройки" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton onClick={handleLogout} sx={{ borderRadius: 2 }}>
                <ListItemIcon>
                  <LogOut size={20} />
                </ListItemIcon>
                <ListItemText primary="Выйти" />
              </ListItemButton>
            </ListItem>
          </List>
        </>
      )}
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
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <Menu />
          </IconButton>
          <Typography 
            variant="h6" 
            noWrap 
            sx={{ 
              flexGrow: 1,
              fontSize: { xs: '1rem', sm: '1.25rem' },
            }}
          >
            {user?.username ? `Привет, ${user.username}` : 'Secure Messenger'}
          </Typography>
          <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1 }}>
            <MessageSquare size={20} />
            <Typography variant="body2" color="text.secondary">
              Защищено шифрованием
            </Typography>
          </Box>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { sm: DRAWER_WIDTH }, flexShrink: { sm: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
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
        
        {/* Floating Action Button for mobile */}
        {isMobile && (
          <IconButton
            color="primary"
            aria-label="add"
            sx={{
              position: 'fixed',
              bottom: 16,
              right: 16,
              width: 56,
              height: 56,
              borderRadius: '50%',
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              '&:hover': {
                bgcolor: 'primary.dark',
              },
            }}
          >
            <Typography>+</Typography>
          </IconButton>
        )}
      </Box>
    </Box>
  );
};

export default ChatLayoutEnhanced;
