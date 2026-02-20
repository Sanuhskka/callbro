import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Drawer,
} from '@mui/material';
import { X } from 'lucide-react';
import UserSearchSimple from './UserSearchSimple';
import MessageSearch from './MessageSearch';
import { useAuth } from '../../hooks/useAuth';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`search-tabpanel-${index}`}
      aria-labelledby={`search-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 2 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

interface SearchPanelProps {
  open: boolean;
  onClose: () => void;
  onUserSelect?: (user: any) => void;
  onMessageSelect?: (message: any) => void;
  onAddContact?: (username: string) => void;
}

const SearchPanel: React.FC<SearchPanelProps> = ({
  open,
  onClose,
  onUserSelect,
  onMessageSelect,
  onAddContact,
}) => {
  const [tabValue, setTabValue] = useState(0);
  const { user } = useAuth();

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

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
            <X />
          </IconButton>
        </Box>

        {/* Simple Navigation */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex' }}>
            <Box
              onClick={() => setTabValue(0)}
              sx={{
                px: 3,
                py: 2,
                cursor: 'pointer',
                borderBottom: tabValue === 0 ? 2 : 1,
                borderColor: tabValue === 0 ? 'primary.main' : 'divider',
                bgcolor: tabValue === 0 ? 'action.selected' : 'transparent'
              }}
            >
              <Typography variant="body2">Пользователи</Typography>
            </Box>
            <Box
              onClick={() => setTabValue(1)}
              sx={{
                px: 3,
                py: 2,
                cursor: 'pointer',
                borderBottom: tabValue === 1 ? 2 : 1,
                borderColor: tabValue === 1 ? 'primary.main' : 'divider',
                bgcolor: tabValue === 1 ? 'action.selected' : 'transparent'
              }}
            >
              <Typography variant="body2">Сообщения</Typography>
            </Box>
          </Box>
        </Box>

        {/* Tab Content */}
        <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
          <TabPanel value={tabValue} index={0}>
            <Box sx={{ mb: 2 }}>
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
          </TabPanel>
          
          <TabPanel value={tabValue} index={1}>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Поиск сообщений по содержимому
              </Typography>
              <MessageSearch
                onMessageSelect={handleMessageSelect}
                placeholder="Введите текст сообщения..."
              />
            </Box>
          </TabPanel>
        </Box>
      </Box>
    </Drawer>
  );
};

export default SearchPanel;
