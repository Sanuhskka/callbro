// WebRTC polyfills and browser compatibility

// Polyfill for getUserMedia
if (!navigator.mediaDevices) {
  (navigator as any).mediaDevices = {};
}

if (!navigator.mediaDevices.getUserMedia) {
  navigator.mediaDevices.getUserMedia = function(constraints) {
    const getUserMedia = (navigator as any).webkitGetUserMedia || (navigator as any).mozGetUserMedia;
    
    if (!getUserMedia) {
      return Promise.reject(new Error('getUserMedia is not implemented in this browser'));
    }
    
    return new Promise((resolve, reject) => {
      getUserMedia.call(navigator, constraints, resolve, reject);
    });
  };
}

// Polyfill for RTCPeerConnection
if (!(window as any).RTCPeerConnection) {
  (window as any).RTCPeerConnection = (window as any).webkitRTCPeerConnection || (window as any).mozRTCPeerConnection;
}

// Polyfill for RTCSessionDescription
if (!(window as any).RTCSessionDescription) {
  (window as any).RTCSessionDescription = (window as any).webkitRTCSessionDescription || (window as any).mozRTCSessionDescription;
}

// Polyfill for RTCIceCandidate
if (!(window as any).RTCIceCandidate) {
  (window as any).RTCIceCandidate = (window as any).webkitRTCIceCandidate || (window as any).mozRTCIceCandidate;
}

// Polyfill for WebSocket in older browsers
if (!(window as any).WebSocket) {
  console.warn('WebSocket is not supported in this browser');
}

// Console polyfill for better debugging
if (!window.console) {
  (window as any).console = {
    log: function() {},
    warn: function() {},
    error: function() {},
    info: function() {},
  };
}

export {};
