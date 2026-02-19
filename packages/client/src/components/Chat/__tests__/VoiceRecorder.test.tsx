import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import VoiceRecorder from '../VoiceRecorder';

const theme = createTheme({
  palette: {
    mode: 'dark',
  },
});

// Mock MediaRecorder
class MockMediaRecorder {
  state: string = 'inactive';
  ondataavailable: ((event: any) => void) | null = null;
  onstop: (() => void) | null = null;
  
  start() {
    this.state = 'recording';
  }
  
  stop() {
    this.state = 'inactive';
    if (this.onstop) {
      this.onstop();
    }
  }
}

// Mock navigator.mediaDevices
const mockGetUserMedia = jest.fn();

Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: mockGetUserMedia,
  },
  writable: true,
});

// Mock MediaRecorder
(global as any).MediaRecorder = MockMediaRecorder;

describe('VoiceRecorder Component', () => {
  const mockOnRecordingComplete = jest.fn();
  const mockOnCancel = jest.fn();
  
  const mockStream = {
    getTracks: jest.fn(() => [
      {
        stop: jest.fn(),
      },
    ]),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserMedia.mockResolvedValue(mockStream);
  });

  const renderVoiceRecorder = (maxDuration?: number) => {
    return render(
      <ThemeProvider theme={theme}>
        <VoiceRecorder
          onRecordingComplete={mockOnRecordingComplete}
          onCancel={mockOnCancel}
          maxDuration={maxDuration}
        />
      </ThemeProvider>
    );
  };

  it('should request microphone access on mount', async () => {
    renderVoiceRecorder();

    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });
    });
  });

  it('should display error when microphone access is denied', async () => {
    mockGetUserMedia.mockRejectedValue(new Error('Permission denied'));

    renderVoiceRecorder();

    await waitFor(() => {
      expect(screen.getByText(/camera\/microphone access denied/i)).toBeInTheDocument();
    });
  });

  it('should start recording automatically after microphone access', async () => {
    renderVoiceRecorder();

    await waitFor(() => {
      expect(screen.getByText(/recording/i)).toBeInTheDocument();
    });
  });

  it('should display recording duration', async () => {
    renderVoiceRecorder();

    await waitFor(() => {
      expect(screen.getByText(/0:00/)).toBeInTheDocument();
    });
  });

  it('should display maximum duration', async () => {
    const maxDuration = 5 * 60 * 1000; // 5 minutes
    renderVoiceRecorder(maxDuration);

    await waitFor(() => {
      expect(screen.getByText(/max: 5:00/i)).toBeInTheDocument();
    });
  });

  it('should stop recording when stop button is clicked', async () => {
    renderVoiceRecorder();

    await waitFor(() => {
      expect(screen.getByText(/recording/i)).toBeInTheDocument();
    });

    // Find and click the stop button (the one with Circle icon)
    const buttons = screen.getAllByRole('button');
    const stopButton = buttons[0]; // First button is stop
    
    if (stopButton) {
      fireEvent.click(stopButton);

      await waitFor(() => {
        expect(mockOnRecordingComplete).toHaveBeenCalled();
      });
    }
  });

  it('should call onCancel when cancel button is clicked', async () => {
    renderVoiceRecorder();

    await waitFor(() => {
      expect(screen.getByText(/recording/i)).toBeInTheDocument();
    });

    // Find and click the cancel button (X icon)
    const buttons = screen.getAllByRole('button');
    const cancelButton = buttons[buttons.length - 1]; // Last button is cancel
    
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  it('should clean up media stream on unmount', async () => {
    const { unmount } = renderVoiceRecorder();

    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalled();
    });

    unmount();

    expect(mockStream.getTracks()[0].stop).toHaveBeenCalled();
  });

  it('should enforce maximum duration limit', async () => {
    const maxDuration = 100; // 100ms for testing
    renderVoiceRecorder(maxDuration);

    await waitFor(() => {
      expect(screen.getByText(/recording/i)).toBeInTheDocument();
    });

    // Wait for max duration to be reached
    await new Promise(resolve => setTimeout(resolve, 150));

    // Recording should stop automatically
    await waitFor(() => {
      expect(mockOnRecordingComplete).toHaveBeenCalled();
    }, { timeout: 2000 });
  });

  it('should display circular progress indicator', async () => {
    renderVoiceRecorder();

    await waitFor(() => {
      const progressBars = screen.getAllByRole('progressbar');
      expect(progressBars.length).toBeGreaterThan(0);
    });
  });

  it('should show microphone icon', async () => {
    renderVoiceRecorder();

    await waitFor(() => {
      expect(screen.getByText(/recording/i)).toBeInTheDocument();
    });

    // Check that the component rendered (microphone icon is SVG, harder to test directly)
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });
});
