import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  IconButton,
  Paper,
  CircularProgress,
  Toolbar,
  AppBar,
  Avatar,
} from '@mui/material';
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  ArrowLeft,
  Maximize2,
  Minimize2,
  Circle,
} from 'lucide-react';
import { useWebRTC } from '../../contexts/WebRTCContext';
import { useNotificationHelpers } from '../../contexts/NotificationContext';

const CallWindow: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'fair' | 'poor'>('excellent');
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const callStartTimeRef = useRef<number>(Date.now());
  
  const {
    activeCall,
    incomingCall,
    isAudioEnabled,
    isVideoEnabled,
    isLoading,
    error,
    initiateCall,
    answerCall,
    rejectCall,
    endCall,
    toggleAudio,
    toggleVideo,
    clearError,
  } = useWebRTC();

  const { showError } = useNotificationHelpers();

  // Mock contact data - in real app, this would come from ContactService
  const contact = {
    id: userId || '',
    username: `User ${userId}`,
  };

  useEffect(() => {
    if (!userId) {
      navigate('/');
      return;
    }

    // Start call duration timer
    const timer = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [userId, navigate]);

  useEffect(() => {
    // Set up video streams when call is active
    if (activeCall && activeCall.localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = activeCall.localStream;
    }
    
    if (activeCall && activeCall.remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = activeCall.remoteStream;
    }
  }, [activeCall]);

  useEffect(() => {
    if (error) {
      showError('Call Error', error);
      clearError();
    }
  }, [error, showError, clearError]);

  const formatCallDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getConnectionQualityColor = () => {
    switch (connectionQuality) {
      case 'excellent': return '#4caf50';
      case 'good': return '#8bc34a';
      case 'fair': return '#ff9800';
      case 'poor': return '#f44336';
    }
  };

  const getConnectionQualityText = () => {
    switch (connectionQuality) {
      case 'excellent': return 'Excellent';
      case 'good': return 'Good';
      case 'fair': return 'Fair';
      case 'poor': return 'Poor';
    }
  };

  const handleEndCall = async () => {
    try {
      await endCall();
      navigate('/');
    } catch (error) {
      console.error('Failed to end call:', error);
    }
  };

  const handleToggleAudio = async () => {
    try {
      await toggleAudio();
    } catch (error) {
      console.error('Failed to toggle audio:', error);
    }
  };

  const handleToggleVideo = async () => {
    try {
      await toggleVideo();
    } catch (error) {
      console.error('Failed to toggle video:', error);
    }
  };

  const handleBackToChat = () => {
    if (activeCall) {
      // Keep call active and go back to chat
      navigate(`/chat/${userId}`);
    } else {
      navigate('/');
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleIncomingCall = async () => {
    if (!incomingCall) return;
    
    try {
      await answerCall(incomingCall.callId, incomingCall.callType);
      callStartTimeRef.current = Date.now();
    } catch (error) {
      console.error('Failed to answer call:', error);
    }
  };

  const handleRejectIncomingCall = async () => {
    if (!incomingCall) return;
    
    try {
      await rejectCall(incomingCall.callId);
      navigate('/');
    } catch (error) {
      console.error('Failed to reject call:', error);
    }
  };

  const handleInitiateCall = async (callType: 'audio' | 'video') => {
    if (!userId) return;
    
    try {
      await initiateCall(userId, callType);
      callStartTimeRef.current = Date.now();
    } catch (error) {
      console.error('Failed to initiate call:', error);
    }
  };

  // Render incoming call UI
  if (incomingCall && incomingCall.userId === userId) {
    return (
      <Box sx={{ height: '100vh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
        <AppBar position="static" color="default" elevation={1}>
          <Toolbar>
            <IconButton onClick={() => navigate('/')} sx={{ mr: 2 }}>
              <ArrowLeft />
            </IconButton>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Incoming {incomingCall.callType} Call
            </Typography>
          </Toolbar>
        </AppBar>

        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 3 }}>
          <Avatar sx={{ width: 120, height: 120, mb: 3, bgcolor: 'primary.main' }}>
            <Typography variant="h3">
              {contact.username.charAt(0).toUpperCase()}
            </Typography>
          </Avatar>
          
          <Typography variant="h4" sx={{ mb: 1, fontWeight: 'bold' }}>
            {contact.username}
          </Typography>
          
          <Typography variant="h6" color="text.secondary" sx={{ mb: 4 }}>
            is calling you...
          </Typography>

          <Box sx={{ display: 'flex', gap: 3 }}>
            <IconButton
              onClick={handleRejectIncomingCall}
              size="large"
              sx={{
                bgcolor: 'error.main',
                color: 'error.contrastText',
                width: 64,
                height: 64,
                '&:hover': {
                  bgcolor: 'error.dark',
                },
              }}
            >
              <PhoneOff size={32} />
            </IconButton>
            
            <IconButton
              onClick={handleIncomingCall}
              size="large"
              sx={{
                bgcolor: 'success.main',
                color: 'success.contrastText',
                width: 64,
                height: 64,
                '&:hover': {
                  bgcolor: 'success.dark',
                },
              }}
            >
              <Phone size={32} />
            </IconButton>
          </Box>
        </Box>
      </Box>
    );
  }

  // Render call setup UI (not in active call yet)
  if (!activeCall && !incomingCall) {
    return (
      <Box sx={{ height: '100vh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
        <AppBar position="static" color="default" elevation={1}>
          <Toolbar>
            <IconButton onClick={handleBackToChat} sx={{ mr: 2 }}>
              <ArrowLeft />
            </IconButton>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              {contact.username}
            </Typography>
          </Toolbar>
        </AppBar>

        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 3 }}>
          {isLoading ? (
            <Box sx={{ textAlign: 'center' }}>
              <CircularProgress size={60} sx={{ mb: 3 }} />
              <Typography variant="h6">Connecting...</Typography>
            </Box>
          ) : (
            <>
              <Avatar sx={{ width: 120, height: 120, mb: 3, bgcolor: 'primary.main' }}>
                <Typography variant="h3">
                  {contact.username.charAt(0).toUpperCase()}
                </Typography>
              </Avatar>
              
              <Typography variant="h4" sx={{ mb: 4, fontWeight: 'bold' }}>
                {contact.username}
              </Typography>

              <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                Start a conversation
              </Typography>

              <Box sx={{ display: 'flex', gap: 3 }}>
                <IconButton
                  onClick={() => handleInitiateCall('audio')}
                  size="large"
                  sx={{
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    width: 64,
                    height: 64,
                    '&:hover': {
                      bgcolor: 'primary.dark',
                    },
                  }}
                >
                  <Phone size={32} />
                </IconButton>
                
                <IconButton
                  onClick={() => handleInitiateCall('video')}
                  size="large"
                  sx={{
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    width: 64,
                    height: 64,
                    '&:hover': {
                      bgcolor: 'primary.dark',
                    },
                  }}
                >
                  <Video size={32} />
                </IconButton>
              </Box>
            </>
          )}
        </Box>
      </Box>
    );
  }

  // Render active call UI
  return (
    <Box sx={{ height: '100vh', bgcolor: 'black', position: 'relative', overflow: 'hidden' }}>
      {/* Remote Video (full screen) */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          bgcolor: 'black',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          muted={false}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
        {!activeCall?.remoteStream && (
          <Box sx={{ textAlign: 'center', color: 'white' }}>
            <Avatar sx={{ width: 120, height: 120, mb: 2, bgcolor: 'grey.700' }}>
              <Typography variant="h3">
                {contact.username.charAt(0).toUpperCase()}
              </Typography>
            </Avatar>
            <Typography variant="h6">Waiting for {contact.username}...</Typography>
          </Box>
        )}
      </Box>

      {/* Local Video (picture-in-picture) */}
      <Paper
        sx={{
          position: 'absolute',
          top: { xs: 70, sm: 80 },
          right: { xs: 10, sm: 20 },
          width: { xs: 120, sm: 160, md: 200 },
          height: { xs: 90, sm: 120, md: 150 },
          bgcolor: 'grey.900',
          overflow: 'hidden',
          border: '2px solid rgba(255, 255, 255, 0.2)',
          borderRadius: 2,
        }}
      >
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: 'scaleX(-1)', // Mirror effect for local video
          }}
        />
        {!activeCall?.localStream && (
          <Box
            sx={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
            }}
          >
            <VideoOff size={32} />
          </Box>
        )}
      </Paper>

      {/* Top Bar */}
      <AppBar
        position="absolute"
        top={0}
        left={0}
        right={0}
        sx={{
          bgcolor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }}>
          <IconButton onClick={handleBackToChat} sx={{ color: 'white', mr: 2 }}>
            <ArrowLeft />
          </IconButton>
          <Typography 
            variant="h6" 
            sx={{ 
              flexGrow: 1, 
              color: 'white',
              fontSize: { xs: '1rem', sm: '1.25rem' },
            }}
          >
            {contact.username}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 } }}>
            <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 0.5 }}>
              <Circle size={8} fill={getConnectionQualityColor()} color={getConnectionQualityColor()} />
              <Typography variant="body2" color="white">
                {getConnectionQualityText()}
              </Typography>
            </Box>
            <Typography 
              variant="body2" 
              color="white"
              sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
            >
              {formatCallDuration(callDuration)}
            </Typography>
          </Box>
          <IconButton 
            onClick={toggleFullscreen} 
            sx={{ 
              color: 'white', 
              ml: { xs: 0.5, sm: 2 },
              display: { xs: 'none', sm: 'inline-flex' },
            }}
          >
            {isFullscreen ? <Minimize2 /> : <Maximize2 />}
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Bottom Controls */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          bgcolor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(10px)',
          p: { xs: 1.5, sm: 2 },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: { xs: 1.5, sm: 2 } }}>
          <IconButton
            onClick={handleToggleAudio}
            size="large"
            sx={{
              bgcolor: isAudioEnabled ? 'rgba(255, 255, 255, 0.2)' : 'error.main',
              color: 'white',
              width: { xs: 48, sm: 56 },
              height: { xs: 48, sm: 56 },
              '&:hover': {
                bgcolor: isAudioEnabled ? 'rgba(255, 255, 255, 0.3)' : 'error.dark',
              },
            }}
          >
            {isAudioEnabled ? <Mic size={24} /> : <MicOff size={24} />}
          </IconButton>

          <IconButton
            onClick={handleToggleVideo}
            size="large"
            sx={{
              bgcolor: isVideoEnabled ? 'rgba(255, 255, 255, 0.2)' : 'error.main',
              color: 'white',
              width: { xs: 48, sm: 56 },
              height: { xs: 48, sm: 56 },
              '&:hover': {
                bgcolor: isVideoEnabled ? 'rgba(255, 255, 255, 0.3)' : 'error.dark',
              },
            }}
          >
            {isVideoEnabled ? <Video size={24} /> : <VideoOff size={24} />}
          </IconButton>

          <IconButton
            onClick={handleEndCall}
            size="large"
            sx={{
              bgcolor: 'error.main',
              color: 'white',
              width: { xs: 48, sm: 56 },
              height: { xs: 48, sm: 56 },
              '&:hover': {
                bgcolor: 'error.dark',
              },
            }}
          >
            <PhoneOff size={24} />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
};

export default CallWindow;
