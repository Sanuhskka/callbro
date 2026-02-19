import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  TextField,
  IconButton,
  Typography,
  Avatar,
  Paper,
  InputAdornment,
  CircularProgress,
} from '@mui/material';
import {
  Send,
  Paperclip,
  Mic,
  Circle,
  Check,
  CheckCheck,
  Video,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { MessagingService, Message } from '../../services/MessagingService';
import { CryptoService } from '../../services/CryptoService';
import { AuthService } from '../../services/AuthService';
import VoiceRecorder from './VoiceRecorder';

const ChatWindow: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const cryptoService = new CryptoService();
  const authService = new AuthService();
  const messagingService = new MessagingService(cryptoService, authService);

  // Загрузка истории сообщений
  useEffect(() => {
    if (userId) {
      loadMessages();
    }
  }, [userId]);

  // Автоскролл к последнему сообщению
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async () => {
    if (!userId) return;

    try {
      setLoading(true);
      const history = await messagingService.getMessageHistory(userId, 50);
      setMessages(history.messages.reverse());
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!userId || (!messageText.trim() && !selectedFile)) return;

    try {
      setSending(true);

      let newMessage: Message;

      if (selectedFile) {
        // Отправка медиа-файла
        newMessage = await messagingService.sendMediaFile(userId, selectedFile);
        setSelectedFile(null);
        setFilePreview(null);
      } else {
        // Отправка текстового сообщения
        newMessage = await messagingService.sendTextMessage(userId, messageText);
      }

      // Добавляем сообщение в список
      setMessages((prev) => [...prev, newMessage]);
      setMessageText('');
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Проверка размера файла (50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('File size exceeds 50MB limit');
      return;
    }

    // Проверка типа файла
    const supportedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'video/mp4',
      'video/webm',
    ];

    if (!supportedTypes.includes(file.type)) {
      alert('Unsupported file format. Supported: JPEG, PNG, GIF, MP4, WebM');
      return;
    }

    setSelectedFile(file);

    // Создание превью
    const reader = new FileReader();
    reader.onload = (e) => {
      setFilePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleStartVoiceRecording = () => {
    setIsRecordingVoice(true);
  };

  const handleVoiceRecordingComplete = async (audioBlob: Blob, duration: number) => {
    if (!userId) return;

    try {
      setSending(true);
      setIsRecordingVoice(false);

      // Отправка голосового сообщения
      const newMessage = await messagingService.sendVoiceMessage(userId, audioBlob, duration);

      // Добавляем сообщение в список
      setMessages((prev) => [...prev, newMessage]);
    } catch (error) {
      console.error('Failed to send voice message:', error);
      alert(error instanceof Error ? error.message : 'Failed to send voice message');
    } finally {
      setSending(false);
    }
  };

  const handleVoiceRecordingCancel = () => {
    setIsRecordingVoice(false);
  };

  const handlePlayVoice = (messageId: string, audioUrl: string) => {
    if (playingVoiceId === messageId) {
      // Останавливаем воспроизведение
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setPlayingVoiceId(null);
    } else {
      // Начинаем воспроизведение
      if (audioRef.current) {
        audioRef.current.pause();
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setPlayingVoiceId(null);
      };

      audio.play();
      setPlayingVoiceId(messageId);
    }
  };

  const formatVoiceDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    // Если сегодня, показываем только время
    if (diff < 24 * 60 * 60 * 1000 && date.getDate() === now.getDate()) {
      return date.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    // Если вчера
    if (diff < 48 * 60 * 60 * 1000 && date.getDate() === now.getDate() - 1) {
      return 'Вчера ' + date.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    // Иначе показываем дату
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderMessageStatus = (message: Message) => {
    if (message.fromUserId !== user?.id) return null;

    if (message.read) {
      return (
        <Box component="span" sx={{ color: '#4caf50', display: 'flex', alignItems: 'center' }}>
          <CheckCheck size={14} />
        </Box>
      );
    }

    if (message.delivered) {
      return (
        <Box component="span" sx={{ color: '#9e9e9e', display: 'flex', alignItems: 'center' }}>
          <CheckCheck size={14} />
        </Box>
      );
    }

    return (
      <Box component="span" sx={{ color: '#9e9e9e', display: 'flex', alignItems: 'center' }}>
        <Check size={14} />
      </Box>
    );
  };

  const renderMediaPreview = (message: Message) => {
    if (message.type !== 'media' || !message.mediaUrl) return null;

    const isImage = message.mediaType?.startsWith('image/');
    const isVideo = message.mediaType?.startsWith('video/');

    if (isImage) {
      return (
        <Box
          component="img"
          src={message.mediaUrl}
          alt="Media"
          sx={{
            maxWidth: { xs: '200px', sm: '300px' },
            maxHeight: { xs: '200px', sm: '300px' },
            borderRadius: 2,
            cursor: 'pointer',
          }}
          onClick={() => window.open(message.mediaUrl, '_blank')}
        />
      );
    }

    if (isVideo) {
      return (
        <Box
          component="video"
          controls
          src={message.mediaUrl}
          sx={{
            maxWidth: { xs: '200px', sm: '300px' },
            maxHeight: { xs: '200px', sm: '300px' },
            borderRadius: 2,
          }}
        />
      );
    }

    return null;
  };

  const renderVoiceMessage = (message: Message) => {
    if (message.type !== 'voice' || !message.mediaUrl) return null;

    const isPlaying = playingVoiceId === message.id;
    const duration = message.voiceDuration || 0;

    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          minWidth: '200px',
        }}
      >
        <IconButton
          size="small"
          onClick={() => handlePlayVoice(message.id, message.mediaUrl!)}
          sx={{
            bgcolor: 'rgba(255, 255, 255, 0.2)',
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.3)',
            },
          }}
        >
          {isPlaying ? (
            <Box sx={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Box sx={{ width: 8, height: 8, bgcolor: 'currentColor', borderRadius: 1 }} />
            </Box>
          ) : (
            <Circle size={20} fill="currentColor" />
          )}
        </IconButton>

        <Box sx={{ flexGrow: 1 }}>
          <Box
            sx={{
              height: '4px',
              bgcolor: 'rgba(255, 255, 255, 0.3)',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                height: '100%',
                width: isPlaying ? '50%' : '0%',
                bgcolor: 'rgba(255, 255, 255, 0.8)',
                transition: 'width 0.3s',
              }}
            />
          </Box>
        </Box>

        <Typography variant="caption" sx={{ minWidth: '40px', textAlign: 'right' }}>
          {formatVoiceDuration(duration)}
        </Typography>
      </Box>
    );
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
        }}
      >
        {!isOwn && (
          <Avatar
            sx={{
              width: { xs: 28, sm: 32 },
              height: { xs: 28, sm: 32 },
              mr: 1,
              bgcolor: 'primary.main',
              display: { xs: 'none', sm: 'flex' },
            }}
          >
            {message.fromUserId.charAt(0).toUpperCase()}
          </Avatar>
        )}

        <Box
          sx={{
            maxWidth: { xs: '85%', sm: '70%' },
            display: 'flex',
            flexDirection: 'column',
            alignItems: isOwn ? 'flex-end' : 'flex-start',
          }}
        >
          <Paper
            elevation={1}
            sx={{
              p: { xs: 1, sm: 1.5 },
              bgcolor: isOwn ? 'primary.main' : 'background.paper',
              color: isOwn ? 'primary.contrastText' : 'text.primary',
              borderRadius: 2,
              borderTopRightRadius: isOwn ? 0 : 2,
              borderTopLeftRadius: isOwn ? 2 : 0,
            }}
          >
            {message.type === 'text' && (
              <Typography 
                variant="body1" 
                sx={{ 
                  whiteSpace: 'pre-wrap',
                  fontSize: { xs: '0.875rem', sm: '1rem' },
                }}
              >
                {message.content}
              </Typography>
            )}

            {message.type === 'media' && renderMediaPreview(message)}

            {message.type === 'voice' && renderVoiceMessage(message)}
          </Paper>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              mt: 0.5,
              px: 1,
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
              {formatTimestamp(message.timestamp)}
            </Typography>
            {renderMessageStatus(message)}
          </Box>
        </Box>

        {isOwn && (
          <Avatar
            sx={{
              width: { xs: 28, sm: 32 },
              height: { xs: 28, sm: 32 },
              ml: 1,
              bgcolor: 'secondary.main',
              display: { xs: 'none', sm: 'flex' },
            }}
          >
            {user?.username?.charAt(0).toUpperCase()}
          </Avatar>
        )}
      </Box>
    );
  };

  if (!userId) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          bgcolor: 'background.default',
        }}
      >
        <Typography variant="h6" color="text.secondary">
          Select a contact to start chatting
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        bgcolor: 'background.default',
      }}
    >
      {/* Messages area */}
      <Box
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {loading ? (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
            }}
          >
            <CircularProgress />
          </Box>
        ) : messages.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
            }}
          >
            <Typography variant="body1" color="text.secondary">
              No messages yet. Start the conversation!
            </Typography>
          </Box>
        ) : (
          messages.map(renderMessage)
        )}
        <div ref={messagesEndRef} />
      </Box>

      {/* File preview */}
      {filePreview && (
        <Box
          sx={{
            p: 2,
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <Box sx={{ position: 'relative', display: 'inline-block' }}>
            {selectedFile?.type.startsWith('image/') ? (
              <Box
                component="img"
                src={filePreview}
                alt="Preview"
                sx={{
                  maxWidth: '200px',
                  maxHeight: '200px',
                  borderRadius: 2,
                }}
              />
            ) : (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  p: 2,
                  bgcolor: 'background.default',
                  borderRadius: 2,
                }}
              >
                <Video size={24} />
                <Typography variant="body2">{selectedFile?.name}</Typography>
              </Box>
            )}
            <IconButton
              size="small"
              onClick={handleRemoveFile}
              sx={{
                position: 'absolute',
                top: -8,
                right: -8,
                bgcolor: 'error.main',
                '&:hover': {
                  bgcolor: 'error.dark',
                },
              }}
            >
              <Typography sx={{ fontSize: '16px', fontWeight: 'bold' }}>✕</Typography>
            </IconButton>
          </Box>
        </Box>
      )}

      {/* Voice recorder */}
      {isRecordingVoice && (
        <Box
          sx={{
            p: 2,
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <VoiceRecorder
            onRecordingComplete={handleVoiceRecordingComplete}
            onCancel={handleVoiceRecordingCancel}
            maxDuration={5 * 60 * 1000}
          />
        </Box>
      )}

      {/* Input area */}
      <Box
        sx={{
          p: { xs: 1, sm: 2 },
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Box sx={{ display: 'flex', gap: { xs: 0.5, sm: 1 }, alignItems: 'flex-end' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,video/mp4,video/webm"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />

          <IconButton
            color="primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending || !!selectedFile || isRecordingVoice}
            size="small"
            sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
          >
            <Paperclip size={20} />
          </IconButton>

          <IconButton
            color="primary"
            onClick={handleStartVoiceRecording}
            disabled={sending || !!selectedFile || isRecordingVoice}
            size="small"
          >
            <Mic size={20} />
          </IconButton>

          <TextField
            fullWidth
            multiline
            maxRows={4}
            placeholder="Type a message..."
            value={messageText}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMessageText(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={sending || !!selectedFile || isRecordingVoice}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 3,
                fontSize: { xs: '0.875rem', sm: '1rem' },
              },
            }}
          />

          <IconButton
            color="primary"
            onClick={handleSendMessage}
            disabled={sending || (!messageText.trim() && !selectedFile) || isRecordingVoice}
            size="small"
            sx={{
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              '&:hover': {
                bgcolor: 'primary.dark',
              },
              '&.Mui-disabled': {
                bgcolor: 'action.disabledBackground',
              },
            }}
          >
            {sending ? <CircularProgress size={20} /> : <Send size={20} />}
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
};

export default ChatWindow;
