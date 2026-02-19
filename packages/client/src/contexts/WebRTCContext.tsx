import React, { createContext, useContext, useReducer, useEffect, ReactNode, useRef } from 'react';
import { WebRTCService, CallSession, CallEvent } from '../services/WebRTCService';
import { SignalingService } from '../services/SignalingService';
import { CryptoService } from '../services/CryptoService';
import { useAuth } from './AuthContext';

interface WebRTCState {
  activeCall: CallSession | null;
  incomingCall: {
    userId: string;
    callId: string;
    callType: 'audio' | 'video';
  } | null;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor';
  isLoading: boolean;
  error: string | null;
}

interface WebRTCContextType extends WebRTCState {
  initiateCall: (userId: string, callType: 'audio' | 'video') => Promise<void>;
  answerCall: (callId: string, callType: 'audio' | 'video') => Promise<void>;
  rejectCall: (callId: string) => Promise<void>;
  endCall: () => Promise<void>;
  toggleAudio: () => Promise<boolean>;
  toggleVideo: () => Promise<boolean>;
  clearError: () => void;
}

const WebRTCContext = createContext<WebRTCContextType | undefined>(undefined);

type WebRTCAction =
  | { type: 'CALL_STARTING' }
  | { type: 'CALL_STARTED'; payload: CallSession }
  | { type: 'CALL_ENDED' }
  | { type: 'INCOMING_CALL'; payload: { userId: string; callId: string; callType: 'audio' | 'video' } }
  | { type: 'INCOMING_CALL_CLEARED' }
  | { type: 'AUDIO_TOGGLED'; payload: boolean }
  | { type: 'VIDEO_TOGGLED'; payload: boolean }
  | { type: 'QUALITY_CHANGED'; payload: 'excellent' | 'good' | 'fair' | 'poor' }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' };

const webRTCReducer = (state: WebRTCState, action: WebRTCAction): WebRTCState => {
  switch (action.type) {
    case 'CALL_STARTING':
      return { ...state, isLoading: true, error: null };
    case 'CALL_STARTED':
      return { 
        ...state, 
        activeCall: action.payload, 
        incomingCall: null, 
        isLoading: false,
        isAudioEnabled: true,
        isVideoEnabled: action.payload.callType === 'video',
      };
    case 'CALL_ENDED':
      return { 
        ...state, 
        activeCall: null, 
        incomingCall: null, 
        isLoading: false,
        isAudioEnabled: true,
        isVideoEnabled: true,
      };
    case 'INCOMING_CALL':
      return { ...state, incomingCall: action.payload };
    case 'INCOMING_CALL_CLEARED':
      return { ...state, incomingCall: null };
    case 'AUDIO_TOGGLED':
      return { ...state, isAudioEnabled: action.payload };
    case 'VIDEO_TOGGLED':
      return { ...state, isVideoEnabled: action.payload };
    case 'QUALITY_CHANGED':
      return { ...state, connectionQuality: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    default:
      return state;
  }
};

const initialState: WebRTCState = {
  activeCall: null,
  incomingCall: null,
  isAudioEnabled: true,
  isVideoEnabled: true,
  connectionQuality: 'excellent',
  isLoading: false,
  error: null,
};

interface WebRTCProviderProps {
  children: ReactNode;
}

export const WebRTCProvider: React.FC<WebRTCProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(webRTCReducer, initialState);
  const { user } = useAuth();
  const servicesRef = useRef<{
    signalingService: SignalingService | null;
    cryptoService: CryptoService | null;
    webRTCService: WebRTCService | null;
  }>({
    signalingService: null,
    cryptoService: null,
    webRTCService: null,
  });

  useEffect(() => {
    if (!user) return;

    const initializeServices = async () => {
      try {
        // Import services dynamically to avoid circular dependencies
        const { AuthService } = await import('../services/AuthService');
        const { SignalingService } = await import('../services/SignalingService');
        const { CryptoService } = await import('../services/CryptoService');
        const { WebRTCService } = await import('../services/WebRTCService');

        const authService = new AuthService(window.location.origin);
        const signalingService = new SignalingService(authService);
        const cryptoService = new CryptoService();
        const webRTCService = new WebRTCService(authService, signalingService, cryptoService);

        servicesRef.current = {
          signalingService,
          cryptoService,
          webRTCService,
        };

        // Setup WebRTC event listeners
        webRTCService.addEventListener('incoming_call', handleIncomingCall);
        webRTCService.addEventListener('call_connected', handleCallConnected);
        webRTCService.addEventListener('call_ended', handleCallEnded);
        webRTCService.addEventListener('error', handleError);

        // Connect to signaling server
        await signalingService.connect();

        console.log('WebRTC services initialized');
      } catch (error) {
        console.error('Failed to initialize WebRTC services:', error);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to initialize call services' });
      }
    };

    initializeServices();

    return () => {
      // Cleanup services
      if (servicesRef.current.webRTCService) {
        servicesRef.current.webRTCService.cleanup();
      }
      if (servicesRef.current.signalingService) {
        servicesRef.current.signalingService.disconnect();
      }
    };
  }, [user]);

  const handleIncomingCall = (event: CallEvent): void => {
    if (event.type === 'incoming_call' && event.data) {
      dispatch({
        type: 'INCOMING_CALL',
        payload: {
          userId: event.userId,
          callId: event.data.callId || '',
          callType: event.data.callType || 'audio',
        },
      });
    }
  };

  const handleCallConnected = (event: CallEvent): void => {
    if (servicesRef.current.webRTCService) {
      const userId = event.userId;
      const session = servicesRef.current.webRTCService.getCallStatus(userId);
      if (session) {
        dispatch({ type: 'CALL_STARTED', payload: session });
      }
    }
  };

  const handleCallEnded = (event: CallEvent): void => {
    dispatch({ type: 'CALL_ENDED' });
  };

  const handleError = (event: CallEvent): void => {
    const message = event.data?.message || 'An error occurred during the call';
    dispatch({ type: 'SET_ERROR', payload: message });
  };

  const initiateCall = async (userId: string, callType: 'audio' | 'video'): Promise<void> => {
    if (!servicesRef.current.webRTCService) {
      throw new Error('WebRTC service not initialized');
    }

    dispatch({ type: 'CALL_STARTING' });

    try {
      await servicesRef.current.webRTCService.initiateCall(userId, callType);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to initiate call';
      dispatch({ type: 'SET_ERROR', payload: message });
      throw error;
    }
  };

  const answerCall = async (callId: string, callType: 'audio' | 'video'): Promise<void> => {
    if (!servicesRef.current.webRTCService || !state.incomingCall) {
      throw new Error('No incoming call to answer');
    }

    try {
      await servicesRef.current.webRTCService.answerCall(
        state.incomingCall.userId,
        callId,
        callType
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to answer call';
      dispatch({ type: 'SET_ERROR', payload: message });
      throw error;
    }
  };

  const rejectCall = async (callId: string): Promise<void> => {
    if (!servicesRef.current.webRTCService || !state.incomingCall) {
      throw new Error('No incoming call to reject');
    }

    try {
      await servicesRef.current.webRTCService.rejectCall(state.incomingCall.userId, callId);
      dispatch({ type: 'INCOMING_CALL_CLEARED' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reject call';
      dispatch({ type: 'SET_ERROR', payload: message });
      throw error;
    }
  };

  const endCall = async (): Promise<void> => {
    if (!servicesRef.current.webRTCService || !state.activeCall) {
      throw new Error('No active call to end');
    }

    try {
      await servicesRef.current.webRTCService.endCall(state.activeCall.userId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to end call';
      dispatch({ type: 'SET_ERROR', payload: message });
      throw error;
    }
  };

  const toggleAudio = async (): Promise<boolean> => {
    if (!servicesRef.current.webRTCService || !state.activeCall) {
      throw new Error('No active call');
    }

    try {
      const isEnabled = await servicesRef.current.webRTCService.toggleAudio(state.activeCall.userId);
      dispatch({ type: 'AUDIO_TOGGLED', payload: isEnabled });
      return isEnabled;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to toggle audio';
      dispatch({ type: 'SET_ERROR', payload: message });
      throw error;
    }
  };

  const toggleVideo = async (): Promise<boolean> => {
    if (!servicesRef.current.webRTCService || !state.activeCall) {
      throw new Error('No active call');
    }

    try {
      const isEnabled = await servicesRef.current.webRTCService.toggleVideo(state.activeCall.userId);
      dispatch({ type: 'VIDEO_TOGGLED', payload: isEnabled });
      return isEnabled;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to toggle video';
      dispatch({ type: 'SET_ERROR', payload: message });
      throw error;
    }
  };

  const clearError = (): void => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  const value: WebRTCContextType = {
    ...state,
    initiateCall,
    answerCall,
    rejectCall,
    endCall,
    toggleAudio,
    toggleVideo,
    clearError,
  };

  return (
    <WebRTCContext.Provider value={value}>
      {children}
    </WebRTCContext.Provider>
  );
};

export const useWebRTC = (): WebRTCContextType => {
  const context = useContext(WebRTCContext);
  if (context === undefined) {
    throw new Error('useWebRTC must be used within a WebRTCProvider');
  }
  return context;
};
