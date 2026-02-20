import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Typography,
  CircularProgress,
  IconButton,
  Paper,
  InputAdornment,
  Badge,
} from '@mui/material';
import {
  User as SearchIcon,
  Circle as CircleIcon,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import Popper from '@mui/material/Popper';
import ClickAwayListener from '@mui/material/ClickAwayListener';

interface SearchResult {
  id: string;
  username: string;
  email?: string;
  isOnline: boolean;
  lastSeen?: string;
}

interface UserSearchProps {
  onUserSelect?: (user: SearchResult) => void;
  onAddContact?: (username: string) => void;
  placeholder?: string;
  showAddButton?: boolean;
}

const UserSearch: React.FC<UserSearchProps> = ({
  onUserSelect,
  onAddContact,
  placeholder = "Поиск пользователей...",
  showAddButton = true,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const { user } = useAuth();
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Поиск пользователей
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    const searchUsers = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('auth-token');
        const response = await fetch(
          `/api/search/users?q=${encodeURIComponent(query)}&limit=20`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          setResults(data.users || []);
          setOpen(true);
          setSelectedIndex(-1);
        } else {
          console.error('Search failed');
          setResults([]);
          setOpen(false);
        }
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(searchUsers, 300);
    return () => clearTimeout(timeoutId);
  }, [query]);

  // Обработка клавиатуры
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setSelectedIndex(prev => 
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        event.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        event.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleUserClick(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Клик по пользователю
  const handleUserClick = (user: SearchResult) => {
    setQuery('');
    setOpen(false);
    setSelectedIndex(-1);
    onUserSelect?.(user);
  };

  // Добавление контакта
  const handleAddContact = (event: React.MouseEvent, user: SearchResult) => {
    event.stopPropagation();
    onAddContact?.(user.username);
  };

  // Закрытие попапа при клике вне
  const handleClickAway = () => {
    setOpen(false);
    setSelectedIndex(-1);
  };

  return (
    <ClickAwayListener onClickAway={handleClickAway}>
      <Box ref={searchRef} sx={{ position: 'relative', width: '100%' }}>
        <TextField
          ref={inputRef}
          fullWidth
          placeholder={placeholder}
          value={query}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && setOpen(true)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                {loading ? (
                  <CircularProgress size={20} />
                ) : (
                  <SearchIcon />
                )}
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
            },
          }}
        />

        <Popper
          open={open}
          anchorEl={searchRef.current}
          placement="bottom-start"
          style={{ width: searchRef.current?.clientWidth, zIndex: 1300 }}
        >
          <Paper
            elevation={8}
            sx={{
              mt: 1,
              maxHeight: 300,
              overflow: 'auto',
              borderRadius: 2,
            }}
          >
            {results.length > 0 ? (
              <List dense>
                {results.map((user, index) => (
                  <ListItem key={user.id} disablePadding>
                    <ListItemButton
                      selected={index === selectedIndex}
                      onClick={() => handleUserClick(user)}
                      sx={{
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
                            <Box
                            sx={{
                              width: 12,
                              height: 12,
                              bgcolor: user.isOnline ? '#4caf50' : '#9e9e9e',
                              borderRadius: '50%',
                            }}
                          />
                          }
                        >
                          <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                            {user.username.charAt(0).toUpperCase()}
                          </Avatar>
                        </Badge>
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography variant="subtitle2" sx={{ fontWeight: 'medium' }}>
                            {user.username}
                          </Typography>
                        }
                        secondary={
                          user.email && (
                            <Typography variant="caption" color="text.secondary">
                              {user.email}
                            </Typography>
                          )
                        }
                      />
                      {showAddButton && onAddContact && (
                        <IconButton
                          size="small"
                          onClick={(e: React.MouseEvent) => handleAddContact(e, user)}
                          sx={{ ml: 1 }}
                        >
                          <Typography fontSize="small">+</Typography>
                        </IconButton>
                      )}
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            ) : query.length >= 2 && !loading ? (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Пользователи не найдены
                </Typography>
              </Box>
            ) : null}
          </Paper>
        </Popper>
      </Box>
    </ClickAwayListener>
  );
};

export default UserSearch;
