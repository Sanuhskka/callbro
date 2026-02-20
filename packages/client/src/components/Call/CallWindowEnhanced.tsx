import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  IconButton,
  Typography,
  Avatar,
  Paper,
  CircularProgress,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/system';
import Grid from '@mui/material/Unstable_Grid2';
import {
  Phone,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  MessageSquare,
  Maximize2,
  Volume2,
  Settings,
  X,
  Users,
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useWebRTC } from '../../contexts/WebRTCContext';

const CallWindowEnhanced: React.FC = () => {
  const { user } = useAuth();
  const { userId: contactId } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [callState, setCallState] = useState<'calling' | 'connected' | 'ended'>('calling');
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [duration, setDuration] = useState(0);
  const [contact, setContact] = useState<any>(null);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const { 
    localStream, 
    remoteStream, 
    isCallActive, 
    endCall, 
    toggleAudio, 
    toggleVideo 
  } = useWebRTC();

  useEffect(() => {
    if (contactId) {
      loadContactInfo();
      // Simulate call connection
      setTimeout(() => {
        setCallState('connected');
      }, 2000);
    }
  }, [contactId]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callState === 'connected') {
      interval = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callState]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, localVideoRef]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, remoteVideoRef]);

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

  const handleEndCall = () => {
    setCallState('ended');
    endCall();
    setTimeout(() => {
      navigate('/chat');
    }, 1000);
  };

  const handleToggleAudio = () => {
    setIsAudioEnabled(!isAudioEnabled);
    toggleAudio();
  };

  const handleToggleVideo = () => {
    setIsVideoEnabled(!isVideoEnabled);
    toggleVideo();
  };

  const handleToggleScreenShare = () => {
    setIsScreenSharing(!isScreenSharing);
    // Screen sharing logic would go here
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const renderVideoGrid = () => {
    const gridColumns = showParticipants ? 2 : 1;
    
    return (
      <Grid container spacing={2} sx={{ height: '100%', p: 2 }}>
        {/* Local Video */}
        <Grid 
          item 
          xs={12} 
          md={gridColumns === 2 ? 6 : 12}
          sx={{ position: 'relative' }}
        >
          <Paper
            sx={{
              height: isMobile ? 200 : 400,
              bgcolor: 'black',
              borderRadius: 2,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
            
            {/* Local Video Controls Overlay */}
            <Box
              sx={{
                position: 'absolute',
                bottom: 8,
                left: 8,
                right: 8,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Typography variant="caption" sx={{ color: 'white', bgcolor: 'rgba(0,0,0,0.7)', px: 1, py: 0.5, borderRadius: 1 }}>
                {user?.username || 'Вы'}
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 1 }}>
                {!isAudioEnabled && (
                  <MicOff size={16} sx={{ color: 'error.main' }} />
                )}
                {!isVideoEnabled && (
                  <VideoOff size={16} sx={{ color: 'error.main' }} />
                )}
              </Box>
            </Box>
          </Paper>
        </Grid>

        {/* Remote Video */}
        <Grid 
          item 
          xs={12} 
          md={gridColumns === 2 ? 6 : 12}
          sx={{ position: 'relative' }}
        >
          <Paper
            sx={{
              height: isMobile ? 200 : 400,
              bgcolor: 'black',
              borderRadius: 2,
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {callState === 'calling' ? (
              <Box sx={{ textAlign: 'center', color: 'white' }}>
                <CircularProgress size={48} sx={{ mb: 2, color: 'white' }} />
                <Typography variant="h6">
                  Вызов {contact?.username}...
                </Typography>
              </Box>
            ) : callState === 'connected' ? (
              <>
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
                
                {/* Remote Video Info Overlay */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  <Avatar
                    sx={{ width: 32, height: 32 }}
                    src={contact?.avatar}
                  >
                    {contact?.username?.charAt(0).toUpperCase()}
                  </Avatar>
                  <Typography variant="caption" sx={{ color: 'white', bgcolor: 'rgba(0,0,0,0.7)', px: 1, py: 0.5, borderRadius: 1 }}>
                    {contact?.username}
                  </Typography>
                </Box>
              </>
            ) : (
              <Box sx={{ textAlign: 'center', color: 'white' }}>
                <Typography variant="h6">
                  Вызов завершен
                </Typography>
                <Typography variant="body2">
                  Длительность: {formatDuration(duration)}
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    );
  };

  return (
    <Box sx={{ height: '100vh', bgcolor: 'black', display: 'flex', flexDirection: 'column' }}>
      {/* Call Header */}
      {callState === 'connected' && (
        <Paper
          elevation={4}
          sx={{
            p: 2,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            bgcolor: 'rgba(0,0,0,0.8)',
            color: 'white',
            backdropFilter: 'blur(10px)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ width: 40, height: 40 }}>
              {contact?.username?.charAt(0).toUpperCase()}
            </Avatar>
            <Box>
              <Typography variant="h6">
                {contact?.username || 'Unknown User'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {formatDuration(duration)}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton onClick={() => setShowChat(!showChat)} sx={{ color: 'white' }}>
              <MessageSquare />
            </IconButton>
            <IconButton onClick={() => setShowParticipants(!showParticipants)} sx={{ color: 'white' }}>
              <Users />
            </IconButton>
            <IconButton onClick={() => setShowSettings(!showSettings)} sx={{ color: 'white' }}>
              <Settings />
            </IconButton>
            <IconButton onClick={() => setIsScreenSharing(!isScreenSharing)} sx={{ color: 'white' }}>
              <Monitor />
            </IconButton>
            <IconButton onClick={() => navigate('/chat')} sx={{ color: 'white' }}>
              <Maximize2 />
            </IconButton>
          </Box>
        </Paper>
      )}

      {/* Video Grid */}
      <Box sx={{ flexGrow: 1, position: 'relative' }}>
        {renderVideoGrid()}
        
        {/* Picture-in-Picture for local video */}
        {isMobile && callState === 'connected' && (
          <Paper
            sx={{
              position: 'absolute',
              bottom: 80,
              right: 16,
              width: 120,
              height: 160,
              bgcolor: 'black',
              borderRadius: 2,
              overflow: 'hidden',
              border: '2px solid',
              borderColor: 'primary.main',
            }}
          >
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </Paper>
        )}
      </Box>

      {/* Call Controls */}
      <Paper
        elevation={8}
        sx={{
          p: 2,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 2,
          bgcolor: 'rgba(0,0,0,0.9)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <IconButton
          onClick={handleToggleAudio}
          size="large"
          sx={{
            bgcolor: isAudioEnabled ? 'grey.700' : 'error.main',
            color: 'white',
            '&:hover': {
              bgcolor: isAudioEnabled ? 'grey.600' : 'error.dark',
            },
          }}
        >
          {isAudioEnabled ? <Mic size={24} /> : <MicOff size={24} />}
        </IconButton>

        <IconButton
          onClick={handleToggleVideo}
          size="large"
          sx={{
            bgcolor: isVideoEnabled ? 'grey.700' : 'error.main',
            color: 'white',
            '&:hover': {
              bgcolor: isVideoEnabled ? 'grey.600' : 'error.dark',
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
            '&:hover': {
              bgcolor: 'error.dark',
            },
          }}
        >
          <Phone size={24} />
        </IconButton>

        <IconButton
          onClick={handleToggleScreenShare}
          size="large"
          sx={{
            bgcolor: isScreenSharing ? 'primary.main' : 'grey.700',
            color: 'white',
            '&:hover': {
              bgcolor: isScreenSharing ? 'primary.dark' : 'grey.600',
            },
          }}
        >
          <Monitor size={24} />
        </IconButton>
      </Paper>
    </Box>
  );
};

export default CallWindowEnhanced;
