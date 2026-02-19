/**
 * Test setup file for Web Crypto API polyfill
 */

import 'jest-environment-jsdom';

// Mock Web Crypto API
Object.defineProperty(global, 'crypto', {
  value: {
    subtle: {
      generateKey: jest.fn().mockResolvedValue({
        publicKey: { type: 'public' },
        privateKey: { type: 'private' },
      }),
      exportKey: jest.fn().mockResolvedValue({ kty: 'EC' }),
      importKey: jest.fn().mockResolvedValue({ type: 'public' }),
      deriveKey: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
      encrypt: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
      decrypt: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
      digest: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
    },
    getRandomValues: jest.fn().mockImplementation((arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }),
  },
  writable: true,
});

// Mock IndexedDB
const mockDB = {
  transaction: jest.fn(),
  objectStore: jest.fn(),
  createObjectStore: jest.fn(),
};

const mockIndexedDB = {
  open: jest.fn(() => ({
    onerror: null,
    onsuccess: null,
    onupgradeneeded: null,
    result: mockDB,
  })),
};

Object.defineProperty(global, 'indexedDB', {
  value: mockIndexedDB,
  writable: true,
});

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.OPEN;
  url = '';
  protocol = '';
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
    // Mock implementation
  }

  close(code?: number, reason?: string) {
    // Mock implementation
  }

  addEventListener(type: string, listener: EventListener) {
    // Mock implementation
  }

  removeEventListener(type: string, listener: EventListener) {
    // Mock implementation
  }
}

Object.defineProperty(global, 'WebSocket', {
  value: MockWebSocket,
  writable: true,
});

// Mock fetch
global.fetch = jest.fn();

// Mock window and localStorage (only if not in jsdom environment)
if (typeof window === 'undefined') {
  Object.defineProperty(global, 'window', {
    value: {},
    writable: true,
  });
}

Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
  writable: true,
  configurable: true,
});

// Mock TextEncoder/TextDecoder
Object.defineProperty(global, 'TextEncoder', {
  value: class TextEncoder {
    encode(input?: string): Uint8Array {
      return new Uint8Array(Buffer.from(input || '', 'utf8'));
    }
  },
  writable: true,
});

Object.defineProperty(global, 'TextDecoder', {
  value: class TextDecoder {
    decode(input?: Uint8Array): string {
      return Buffer.from(input || []).toString('utf8');
    }
  },
  writable: true,
});

// Mock Blob
Object.defineProperty(global, 'Blob', {
  value: class Blob {
    size: number;
    type: string;

    constructor(parts?: BlobPart[], options?: BlobPropertyBag) {
      this.size = 0;
      this.type = options?.type || '';
    }

    arrayBuffer(): Promise<ArrayBuffer> {
      return Promise.resolve(new ArrayBuffer(0));
    }

    bytes(): Promise<Uint8Array> {
      return Promise.resolve(new Uint8Array());
    }

    stream(): ReadableStream {
      return new ReadableStream();
    }

    text(): Promise<string> {
      return Promise.resolve('');
    }

    slice(): Blob {
      return new Blob();
    }
  },
  writable: true,
});

// Mock File
Object.defineProperty(global, 'File', {
  value: class File extends Blob {
    name: string;
    lastModified: number;

    constructor(parts: BlobPart[], name: string, options?: FilePropertyBag) {
      super(parts, options);
      this.name = name;
      this.lastModified = Date.now();
    }
  },
  writable: true,
});

// Mock ReadableStream
Object.defineProperty(global, 'ReadableStream', {
  value: class ReadableStream {
    constructor() {}
  },
  writable: true,
});
