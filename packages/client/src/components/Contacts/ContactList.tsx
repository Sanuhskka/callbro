import React, { useState, useEffect } from 'react';
import {
  Box,
  List,
  ListItem,
  Avatar,
  Typography,
  IconButton,
  TextField,
  InputAdornment,
  CircularProgress,
} from '@mui/material';
import {
  User,
  Phone,
  MessageSquare,
  Circle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

interface Contact {
  id: string;
  contactUserId: string;
  contactUsername: string;
  addedAt: string;
  nickname?: string;
  isOnline?: boolean;
}

interface SearchResult {
  id: string;
  username: string;
  isOnline: boolean;
}

const ContactList: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // Загружаем контакты при монтировании
  useEffect(() => {
    loadContacts();
  }, []);

  // Поиск пользователей
  useEffect(() => {
    if (searchQuery.trim()) {
      const timeoutId = setTimeout(() => {
        searchUsers(searchQuery.trim());
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      setSearchResults([]);
      setShowSearch(false);
    }
  }, [searchQuery]);

  const loadContacts = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('auth-token');
      const response = await fetch(`/api/contacts?userId=${user.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setContacts(data.contacts || []);
      } else {
        console.error('Failed to load contacts');
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async (query: string) => {
    if (!user) return;

    try {
      setSearching(true);
      const token = localStorage.getItem('auth-token');
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.users || []);
        setShowSearch(true);
      } else {
        console.error('Failed to search users');
      }
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setSearching(false);
    }
  };

  const addContact = async (username: string) => {
    if (!user) return;

    try {
      const token = localStorage.getItem('auth-token');
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: user.id,
          contactUsername: username,
        }),
      });

      if (response.ok) {
        // Обновляем список контактов
        await loadContacts();
        // Очищаем поиск
        setSearchQuery('');
        setSearchResults([]);
        setShowSearch(false);
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to add contact');
      }
    } catch (error) {
      console.error('Error adding contact:', error);
      alert('Failed to add contact');
    }
  };

  const openChat = (contactUserId: string) => {
    navigate(`/chat/${contactUserId}`);
  };

  const startCall = (contactUserId: string, type: 'audio' | 'video') => {
    navigate(`/call/${contactUserId}`);
  };

  const formatLastSeen = (date: string) => {
    const lastSeen = new Date(date);
    const now = new Date();
    const diff = now.getTime() - lastSeen.getTime();

    if (diff < 60000) { // Меньше минуты
      return 'только что';
    } else if (diff < 3600000) { // Меньше часа
      return `${Math.floor(diff / 60000)} мин. назад`;
    } else if (diff < 86400000) { // Меньше дня
      return `${Math.floor(diff / 3600000)} ч. назад`;
    } else {
      return lastSeen.toLocaleDateString('ru-RU');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      {/* Заголовок с поиском */}
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Контакты
        </Typography>
        
        <TextField
          fullWidth
          placeholder="Поиск пользователей..."
          value={searchQuery}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                {searching ? <CircularProgress size={20} /> : <User size={20} />}
              </InputAdornment>
            ),
          }}
          sx={{ mb: 1 }}
        />

        {/* Результаты поиска */}
        {showSearch && searchResults.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Результаты поиска
            </Typography>
            <List dense>
              {searchResults.map((result) => (
                <ListItem key={result.id} sx={{ px: 1, py: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <Avatar sx={{ width: 32, height: 32, mr: 2, bgcolor: 'primary.main' }}>
                      {result.username.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="body2">
                        {result.username}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Circle 
                          size={8} 
                          fill={result.isOnline ? '#4caf50' : '#9e9e9e'} 
                          color={result.isOnline ? '#4caf50' : '#9e9e9e'}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {result.isOnline ? 'В сети' : 'Не в сети'}
                        </Typography>
                      </Box>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={() => addContact(result.username)}
                      sx={{ ml: 1 }}
                    >
                      <User size={16} />
                    </IconButton>
                  </Box>
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {showSearch && searchResults.length === 0 && !searching && (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Пользователи не найдены
            </Typography>
          </Box>
        )}
      </Box>

      {/* Список контактов */}
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        {contacts.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Box sx={{ mb: 2 }}>
              <User size={48} />
            </Box>
            <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
              Нет контактов
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Используйте поиск для добавления новых контактов
            </Typography>
          </Box>
        ) : (
          <List>
            {contacts.map((contact) => (
              <ListItem
                key={contact.id}
                sx={{
                  px: 2,
                  py: 1.5,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                }}
                onClick={() => openChat(contact.contactUserId)}
              >
                <Box sx={{ position: 'relative', mr: 2 }}>
                  <Avatar sx={{ bgcolor: 'primary.main' }}>
                    {(contact.nickname || contact.contactUsername).charAt(0).toUpperCase()}
                  </Avatar>
                  {contact.isOnline && (
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        width: 12,
                        height: 12,
                        bgcolor: '#4caf50',
                        border: '2px solid',
                        borderColor: 'background.paper',
                        borderRadius: '50%',
                      }}
                    />
                  )}
                </Box>
                
                <Box sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="subtitle1">
                      {contact.nickname || contact.contactUsername}
                    </Typography>
                    {contact.isOnline && (
                      <Typography
                        variant="caption"
                        sx={{
                          bgcolor: 'success.main',
                          color: 'success.contrastText',
                          px: 1,
                          py: 0.25,
                          borderRadius: 1,
                          fontSize: '0.7rem',
                        }}
                      >
                        В сети
                      </Typography>
                    )}
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Добавлен {formatLastSeen(contact.addedAt)}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <IconButton
                    size="small"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      startCall(contact.contactUserId, 'audio');
                    }}
                    sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}
                  >
                    <Phone size={16} />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      startCall(contact.contactUserId, 'video');
                    }}
                    sx={{ bgcolor: 'secondary.main', color: 'secondary.contrastText' }}
                  >
                    <MessageSquare size={16} />
                  </IconButton>
                </Box>
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
};

export default ContactList;
