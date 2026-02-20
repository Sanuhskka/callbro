import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  CircularProgress,
  Paper,
  InputAdornment,
  Divider,
} from '@mui/material';
import { useAuth } from '../../hooks/useAuth';

interface MessageResult {
  id: string;
  fromUserId: string;
  toUserId: string;
  content: string;
  type: 'text' | 'media' | 'voice';
  timestamp: string;
  fromUsername: string;
  toUsername: string;
}

interface MessageSearchProps {
  onMessageSelect?: (message: MessageResult) => void;
  placeholder?: string;
}

const MessageSearch: React.FC<MessageSearchProps> = ({
  onMessageSelect,
  placeholder = "Поиск сообщений...",
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MessageResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  
  const { user } = useAuth();

  // Поиск сообщений
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    const searchMessages = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('auth-token');
        const response = await fetch(
          `/api/search/messages?q=${encodeURIComponent(query)}&limit=50`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          setResults(data.messages || []);
          setOpen(true);
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

    const timeoutId = setTimeout(searchMessages, 300);
    return () => clearTimeout(timeoutId);
  }, [query]);

  // Клик по сообщению
  const handleMessageClick = (message: MessageResult) => {
    setQuery('');
    setOpen(false);
    onMessageSelect?.(message);
  };

  // Форматирование времени
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) {
      return 'Только что';
    } else if (diffHours < 24) {
      return `${diffHours} ч назад`;
    } else if (diffDays < 7) {
      return `${diffDays} д назад`;
    } else {
      return date.toLocaleDateString('ru-RU');
    }
  };

  // Подсветка поискового запроса в тексте
  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <span>
        {parts.map((part, index) => 
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={index} style={{ backgroundColor: '#ffeb3b', padding: '2px' }}>
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  return (
    <Box sx={{ position: 'relative', width: '100%' }}>
      <TextField
        fullWidth
        placeholder={placeholder}
        value={query}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              {loading ? (
                <CircularProgress size={20} />
              ) : (
                <Typography color="action">🔍</Typography>
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

      {open && (
        <Paper
          elevation={8}
          sx={{
            mt: 1,
            maxHeight: 400,
            overflow: 'auto',
            borderRadius: 2,
            position: 'absolute',
            width: '100%',
            zIndex: 1300,
          }}
        >
          {results.length > 0 ? (
            <List dense>
              {results.map((message, index) => (
                <React.Fragment key={message.id}>
                  <ListItem disablePadding>
                    <ListItemButton
                      onClick={() => handleMessageClick(message)}
                      sx={{
                        py: 1.5,
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                      }}
                    >
                      <Box sx={{ width: '100%', mb: 0.5 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 'medium' }}>
                            {message.fromUserId === user?.id ? (
                              <>Вы → {message.toUsername}</>
                            ) : (
                              <>{message.fromUsername} → Вам</>
                            )}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatTime(message.timestamp)}
                          </Typography>
                        </Box>
                        <Typography
                          variant="body2"
                          color="text.primary"
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            lineHeight: 1.4,
                          }}
                        >
                          {highlightText(message.content, query)}
                        </Typography>
                      </Box>
                    </ListItemButton>
                  </ListItem>
                  {index < results.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          ) : query.length >= 2 && !loading ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Сообщения не найдены
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Попробуйте изменить поисковый запрос
              </Typography>
            </Box>
          ) : null}
        </Paper>
      )}
    </Box>
  );
};

export default MessageSearch;
