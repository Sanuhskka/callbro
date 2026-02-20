import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Typography,
  Avatar,
  Paper,
  Fab,
  Chip,
  CircularProgress,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Send,
  Mic,
  MicOff,
  Phone,
  Video,
  Paperclip,
  Smile,
  MoreVertical,
  Circle,
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useWebRTC } from '../../contexts/WebRTCContext';

interface Message {
  id: string;
  fromUserId: string;
  toUserId: string;
  content: string;
  type: 'text' | 'media' | 'voice';
  timestamp: string;
  status: 'sent' | 'delivered' | 'read';
  mediaUrl?: string;
  mediaType?: string;
}

const ChatWindowEnhanced: React.FC = () => {
  const { user } = useAuth();
  const { userId: contactId } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [contact, setContact] = useState<any>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttach, setShowAttach] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (contactId) {
      loadMessages();
      loadContactInfo();
    }
  }, [contactId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async () => {
    if (!user || !contactId) return;
    
    try {
      setLoading(true);
      const token = localStorage.getItem('auth-token');
      const response = await fetch(`/api/messages/history?userId=${user.id}&contactId=${contactId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadContactInfo = async () => {
    if (!contactId) return;
    
    try {
      const token = localStorage.getItem('auth-token');
      const response = await fetch(`/api/users/${contactId}/public-key`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setContact(data);
      }
    } catch (error) {
      console.error('Error loading contact info:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async () => {
    if (!messageText.trim() || !user || !contactId) return;

    try {
      const token = localStorage.getItem('auth-token');
      const response = await fetch('/api/messages/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          fromUserId: user.id,
          toUserId: contactId,
          content: messageText,
          type: 'text',
        }),
      });

      if (response.ok) {
        setMessageText('');
        // Add message to local state
        const newMessage: Message = {
          id: Date.now().toString(),
          fromUserId: user.id,
          toUserId: contactId,
          content: messageText,
          type: 'text',
          timestamp: new Date().toISOString(),
          status: 'sent',
        };
        setMessages(prev => [...prev, newMessage]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadFile(files[0]);
    }
  };

  const uploadFile = async (file: File) => {
    if (!user || !contactId) return;

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', user.id);

      const token = localStorage.getItem('auth-token');
      const response = await fetch('/api/media/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        // Send media message
        const mediaResponse = await fetch('/api/messages/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            fromUserId: user.id,
            toUserId: contactId,
            content: data.filename,
            type: 'media',
            mediaUrl: data.url,
            mediaType: file.type,
          }),
        });

        if (mediaResponse.ok) {
          // Add media message to local state
          const newMessage: Message = {
            id: Date.now().toString(),
            fromUserId: user.id,
            toUserId: contactId,
            content: data.filename,
            type: 'media',
            timestamp: new Date().toISOString(),
            status: 'sent',
            mediaUrl: data.url,
            mediaType: file.type,
          };
          setMessages(prev => [...prev, newMessage]);
        }
      }
    } catch (error) {
      console.error('Error uploading file:', error);
    }
  };

  const startVoiceRecording = () => {
    setIsRecording(true);
    // Voice recording logic would go here
  };

  const stopVoiceRecording = () => {
    setIsRecording(false);
    // Voice recording stop logic would go here
  };

  const startCall = (type: 'audio' | 'video') => {
    navigate(`/call/${contactId}`);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const renderMessage = (message: Message) => {
    const isOwn = message.fromUserId === user?.id;
    
    return (
      <Box
        key={message.id}
        sx={{
          display: 'flex',
          justifyContent: isOwn ? 'flex-end' : 'flex-start',
          mb: 2,
          px: isMobile ? 1 : 2,
        }}
      >
        <Box
          sx={{
            maxWidth: isMobile ? '85%' : '70%',
            minWidth: '120px',
          }}
        >
          {!isOwn && (
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Avatar
                sx={{ width: 32, height: 32, mr: 1 }}
                src={contact?.avatar}
              >
                {contact?.username?.charAt(0).toUpperCase()}
              </Avatar>
              <Typography variant="caption" color="text.secondary">
                {contact?.username}
              </Typography>
            </Box>
          )}
          
          <Paper
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: isOwn ? 'primary.main' : 'background.paper',
              color: isOwn ? 'primary.contrastText' : 'text.primary',
              borderBottomRightRadius: isOwn ? 0 : 2,
              borderBottomLeftRadius: isOwn ? 2 : 0,
              boxShadow: 1,
            }}
          >
            {message.type === 'text' && (
              <Typography variant="body2">
                {message.content}
              </Typography>
            )}
            
            {message.type === 'media' && message.mediaUrl && (
              <Box>
                {message.mediaType?.startsWith('image/') ? (
                  <img
                    src={message.mediaUrl}
                    alt={message.content}
                    style={{
                      maxWidth: '100%',
                      borderRadius: 8,
                      maxHeight: 200,
                    }}
                  />
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Paperclip size={16} />
                    <Typography variant="body2">
                      {message.content}
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
            
            {message.type === 'voice' && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Mic size={16} />
                <Typography variant="body2">
                  Голосовое сообщение
                </Typography>
              </Box>
            )}
          </Paper>
          
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5, justifyContent: isOwn ? 'flex-end' : 'flex-start' }}>
            <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
              {formatTime(message.timestamp)}
            </Typography>
            {isOwn && (
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {message.status === 'sent' && <Circle size={8} fill="#9e9e9e" color="#9e9e9e" />}
                {message.status === 'delivered' && <Circle size={8} fill="#2196f3" color="#2196f3" />}
                {message.status === 'read' && <Circle size={8} fill="#4caf50" color="#4caf50" />}
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    );
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
      {/* Header */}
      <Paper
        elevation={1}
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {isMobile && (
            <IconButton onClick={() => navigate('/chat')} sx={{ mr: 1 }}>
              <Phone />
            </IconButton>
          )}
          <Avatar sx={{ width: 40, height: 40, mr: 2 }}>
            {contact?.username?.charAt(0).toUpperCase()}
          </Avatar>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 'medium' }}>
              {contact?.username || 'Unknown User'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {isTyping ? 'печатает...' : 'в сети'}
            </Typography>
          </Box>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton onClick={() => startCall('audio')}>
            <Phone />
          </IconButton>
          <IconButton onClick={() => startCall('video')}>
            <Video />
          </IconButton>
          <IconButton>
            <MoreVertical />
          </IconButton>
        </Box>
      </Paper>

      {/* Messages */}
      <Box
        sx={{
          flexGrow: 1,
          overflow: 'auto',
          py: 2,
          bgcolor: 'background.default',
        }}
      >
        {messages.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
              Нет сообщений
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Начните общение с {contact?.username}
            </Typography>
          </Box>
        ) : (
          messages.map(renderMessage)
        )}
        <div ref={messagesEndRef} />
      </Box>

      {/* Input Area */}
      <Paper
        elevation={3}
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'flex-end',
          gap: 1,
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          accept="image/*,video/*,audio/*"
        />
        
        <IconButton onClick={() => fileInputRef.current?.click()}>
          <Paperclip />
        </IconButton>
        
        <IconButton onClick={() => setShowEmoji(!showEmoji)}>
          <Smile />
        </IconButton>
        
        <TextField
          fullWidth
          multiline
          maxRows={4}
          placeholder="Введите сообщение..."
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyPress={handleKeyPress}
          variant="outlined"
          size="small"
          sx={{ flexGrow: 1 }}
        />
        
        <IconButton
          onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
          color={isRecording ? 'error' : 'default'}
        >
          {isRecording ? <MicOff /> : <Mic />}
        </IconButton>
        
        <IconButton
          onClick={sendMessage}
          disabled={!messageText.trim()}
          color="primary"
        >
          <Send />
        </IconButton>
      </Paper>
    </Box>
  );
};

export default ChatWindowEnhanced;
