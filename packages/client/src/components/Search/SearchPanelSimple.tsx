import React, { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Drawer,
  Button,
} from '@mui/material';
import UserSearchSimple from './UserSearchSimple';
import MessageSearch from './MessageSearch';
import { useAuth } from '../../hooks/useAuth';

interface SearchPanelProps {
  open: boolean;
  onClose: () => void;
  onUserSelect?: (user: any) => void;
  onMessageSelect?: (message: any) => void;
  onAddContact?: (username: string) => void;
}

const SearchPanelSimple: React.FC<SearchPanelProps> = ({
  open,
  onClose,
  onUserSelect,
  onMessageSelect,
  onAddContact,
}) => {
  const [searchType, setSearchType] = useState<'users' | 'messages'>('users');
  const { user } = useAuth();

  const handleUserSelect = (selectedUser: any) => {
    onUserSelect?.(selectedUser);
    onClose();
  };

  const handleMessageSelect = (selectedMessage: any) => {
    onMessageSelect?.(selectedMessage);
    onClose();
  };

  const handleAddContact = (username: string) => {
    onAddContact?.(username);
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: 400,
          p: 0,
        },
      }}
    >
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          p: 2,
          borderBottom: 1,
          borderColor: 'divider'
        }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            Поиск
          </Typography>
          <IconButton onClick={onClose} size="small">
            <Typography sx={{ fontSize: '20px' }}>✕</Typography>
          </IconButton>
        </Box>

        {/* Search Type Selector */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', gap: 1 }}>
          <Button
            variant={searchType === 'users' ? 'contained' : 'outlined'}
            onClick={() => setSearchType('users')}
            sx={{ flex: 1 }}
          >
            Пользователи
          </Button>
          <Button
            variant={searchType === 'messages' ? 'contained' : 'outlined'}
            onClick={() => setSearchType('messages')}
            sx={{ flex: 1 }}
          >
            Сообщения
          </Button>
        </Box>

        {/* Search Content */}
        <Box sx={{ flexGrow: 1, overflow: 'hidden', p: 2 }}>
          {searchType === 'users' && (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Поиск пользователей по имени пользователя
              </Typography>
              <UserSearchSimple
                onUserSelect={handleUserSelect}
                onAddContact={handleAddContact}
                placeholder="Введите имя пользователя..."
                showAddButton={true}
              />
            </Box>
          )}
          
          {searchType === 'messages' && (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Поиск сообщений по содержимому
              </Typography>
              <MessageSearch
                onMessageSelect={handleMessageSelect}
                placeholder="Введите текст сообщения..."
              />
            </Box>
          )}
        </Box>
      </Box>
    </Drawer>
  );
};

export default SearchPanelSimple;
