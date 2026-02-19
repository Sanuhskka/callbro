import '@testing-library/jest-dom';

// Extend Jest matchers manually
expect.extend({
  toBeInTheDocument: (element: any) => {
    const pass = element && element.nodeType === Node.ELEMENT_NODE;
    return {
      pass,
      message: () => 'expected element to be in the document',
    };
  },
  toHaveValue: (element: any, value: string) => {
    const pass = element && element.value === value;
    return {
      pass,
      message: () => `expected element to have value ${value}`,
    };
  },
  toHaveAttribute: (element: any, attr: string, value?: string) => {
    const pass = element && element.hasAttribute(attr) && (value === undefined || element.getAttribute(attr) === value);
    return {
      pass,
      message: () => `expected element to have attribute ${attr}${value ? ` with value ${value}` : ''}`,
    };
  },
});

// Add type declarations for Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toHaveValue(value: string): R;
      toHaveAttribute(attr: string, value?: string): R;
    }
  }
}

// Mock WebRTC APIs
Object.defineProperty(global, 'RTCPeerConnection', {
  writable: true,
  value: jest.fn().mockImplementation(() => ({
    createOffer: jest.fn().mockResolvedValue({ type: 'offer', sdp: 'mock-sdp' }),
    createAnswer: jest.fn().mockResolvedValue({ type: 'answer', sdp: 'mock-sdp' }),
    setLocalDescription: jest.fn().mockResolvedValue(undefined),
    setRemoteDescription: jest.fn().mockResolvedValue(undefined),
    addIceCandidate: jest.fn().mockResolvedValue(undefined),
    addTrack: jest.fn(),
    close: jest.fn(),
    onicecandidate: null,
    ontrack: null,
    onconnectionstatechange: null,
    connectionState: 'connected',
  })),
});

Object.defineProperty(global, 'RTCSessionDescription', {
  writable: true,
  value: jest.fn().mockImplementation((desc) => desc),
});

Object.defineProperty(global, 'RTCIceCandidate', {
  writable: true,
  value: jest.fn().mockImplementation((candidate) => candidate),
});

// Mock MediaDevices
Object.defineProperty(global, 'navigator', {
  writable: true,
  value: {
    ...global.navigator,
    mediaDevices: {
      getUserMedia: jest.fn().mockResolvedValue({
        getTracks: () => [
          { getSettings: () => ({ deviceId: 'camera' }), stop: jest.fn() },
          { getSettings: () => ({ deviceId: 'microphone' }), stop: jest.fn() },
        ],
      }),
    },
  },
});

// Mock WebSocket
Object.defineProperty(global, 'WebSocket', {
  writable: true,
  value: jest.fn().mockImplementation(() => ({
    close: jest.fn(),
    send: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    readyState: 1,
  })),
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock IndexedDB
const indexedDBMock = {
  open: jest.fn().mockReturnValue({
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
  }),
};
Object.defineProperty(window, 'indexedDB', {
  value: indexedDBMock,
});

// Suppress console warnings during tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is deprecated')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
