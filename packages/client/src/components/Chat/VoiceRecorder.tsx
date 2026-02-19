import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  IconButton,
  Typography,
  CircularProgress,
  Paper,
} from '@mui/material';
import { Mic, Circle, X } from 'lucide-react';

interface VoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob, duration: number) => void;
  onCancel: () => void;
  maxDuration?: number; // в миллисекундах
}

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onRecordingComplete,
  onCancel,
  maxDuration = 5 * 60 * 1000, // 5 минут по умолчанию
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Запрашиваем доступ к микрофону при монтировании компонента
    requestMicrophoneAccess();

    return () => {
      // Очищаем ресурсы при размонтировании
      cleanup();
    };
  }, []);

  const requestMicrophoneAccess = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      startRecording(stream);
    } catch (err) {
      console.error('Failed to access microphone:', err);
      setError('Camera/microphone access denied');
    }
  };

  const startRecording = (stream: MediaStream) => {
    try {
      // Создаем MediaRecorder с поддержкой WebM
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const recordingDuration = Date.now() - startTimeRef.current;
        
        // Проверяем, не превышена ли максимальная длительность
        if (recordingDuration <= maxDuration) {
          onRecordingComplete(audioBlob, recordingDuration);
        } else {
          setError('Voice message duration exceeds 5 minutes limit');
        }
        
        cleanup();
      };

      // Начинаем запись
      mediaRecorder.start();
      setIsRecording(true);
      startTimeRef.current = Date.now();

      // Запускаем таймер для отображения длительности
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        setDuration(elapsed);

        // Автоматически останавливаем запись при достижении максимальной длительности
        if (elapsed >= maxDuration) {
          stopRecording();
        }
      }, 100);
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Failed to start recording');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const handleCancel = () => {
    cleanup();
    onCancel();
  };

  const cleanup = () => {
    // Останавливаем запись
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }

    // Останавливаем таймер
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Освобождаем медиа-поток
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
    setDuration(0);
  };

  const formatDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = (): number => {
    return (duration / maxDuration) * 100;
  };

  if (error) {
    return (
      <Paper
        elevation={2}
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          bgcolor: 'error.light',
        }}
      >
        <Typography variant="body2" color="error.dark">
          {error}
        </Typography>
        <IconButton size="small" onClick={handleCancel}>
          <X size={20} />
        </IconButton>
      </Paper>
    );
  }

  return (
    <Paper
      elevation={2}
      sx={{
        p: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        bgcolor: 'background.paper',
      }}
    >
      {/* Иконка микрофона с анимацией */}
      <Box
        sx={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress
          variant="determinate"
          value={getProgressPercentage()}
          size={48}
          sx={{
            color: 'error.main',
          }}
        />
      <Box
        sx={{
          position: 'absolute',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Box
          sx={{
            width: 24,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Mic
            size={24}
            className={isRecording ? 'pulse-animation' : ''}
          />
        </Box>
      </Box>
      </Box>

      {/* Длительность записи */}
      <Box sx={{ flexGrow: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Recording...
        </Typography>
        <Typography variant="h6" color="text.primary">
          {formatDuration(duration)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Max: {formatDuration(maxDuration)}
        </Typography>
      </Box>

      {/* Кнопка остановки записи */}
      <IconButton
        onClick={stopRecording}
        disabled={!isRecording}
        sx={{
          bgcolor: 'error.main',
          color: 'white',
          '&:hover': {
            bgcolor: 'error.dark',
          },
          '&.Mui-disabled': {
            bgcolor: 'action.disabledBackground',
          },
        }}
      >
        <Circle size={20} fill="currentColor" />
      </IconButton>

      {/* Кнопка отмены */}
      <IconButton onClick={handleCancel} size="small">
        <X size={20} />
      </IconButton>

      {/* CSS анимация для пульсации микрофона */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.5;
            }
          }
          .pulse-animation {
            color: #f44336;
            animation: pulse 1.5s ease-in-out infinite;
          }
        `}
      </style>
    </Paper>
  );
};

export default VoiceRecorder;
