import { io } from 'socket.io-client';

/**
 * SignalingService
 * 
 * Manages client-side Socket.IO connection to the signaling server for
 * WebRTC SDP offer/answer handshakes and ICE candidate exchange.
 */
class SignalingService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.currentRoomId = null;
    this.listeners = new Map();
  }

  /**
   * Connects to the signaling server.
   * 
   * @param {string} url Optional server URL (defaults to http://localhost:5000)
   */
  connect(url = null) {
    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    const serverUrl =
      url ||
      (typeof window !== 'undefined'
        ? `http://${window.location.hostname}:5000`
        : 'http://localhost:5000');

    console.log(`[Signaling] Connecting to server at ${serverUrl}...`);

    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      timeout: 10000
    });

    this.socket.on('connect', () => {
      console.log(`[Signaling] Connected with socket ID: ${this.socket.id}`);
      this.isConnected = true;
      this.emitLocal('connected', { socketId: this.socket.id });
    });

    this.socket.on('connect_error', (err) => {
      console.warn('[Signaling] Connection error:', err.message);
      this.isConnected = false;
      this.emitLocal('error', err);
    });

    this.socket.on('disconnect', (reason) => {
      console.log(`[Signaling] Disconnected: ${reason}`);
      this.isConnected = false;
      this.emitLocal('disconnected', { reason });
    });

    // Relay inbound server events to registered handlers
    const inboundEvents = [
      'room-joined',
      'user-connected',
      'user-disconnected',
      'offer',
      'answer',
      'ice-candidate',
      'remote-sign-event',
      'remote-speech-transcript',
      'chat-message'
    ];

    inboundEvents.forEach((evt) => {
      this.socket.on(evt, (data) => {
        this.emitLocal(evt, data);
      });
    });

    return this.socket;
  }

  /**
   * Joins a specific room.
   */
  joinRoom(roomId, userId, role = 'unified') {
    if (!this.socket) this.connect();
    this.currentRoomId = roomId;
    this.socket.emit('join-room', { roomId, userId, role });
  }

  sendOffer(targetSocketId, sdp, roomId) {
    if (this.socket) {
      this.socket.emit('offer', { targetSocketId, sdp, roomId });
    }
  }

  sendAnswer(targetSocketId, sdp, roomId) {
    if (this.socket) {
      this.socket.emit('answer', { targetSocketId, sdp, roomId });
    }
  }

  sendIceCandidate(targetSocketId, candidate, roomId) {
    if (this.socket) {
      this.socket.emit('ice-candidate', { targetSocketId, candidate, roomId });
    }
  }

  sendSignEvent(roomId, sign) {
    if (this.socket) {
      this.socket.emit('sign-event', { roomId, sign });
    }
  }

  sendSpeechTranscript(roomId, transcript, isFinal) {
    if (this.socket) {
      this.socket.emit('speech-transcript', { roomId, transcript, isFinal });
    }
  }

  sendChatMessage(roomId, message, senderName) {
    if (this.socket) {
      this.socket.emit('chat-message', { roomId, message, senderName });
    }
  }

  on(eventName, callback) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName).add(callback);
  }

  off(eventName, callback) {
    if (this.listeners.has(eventName)) {
      this.listeners.get(eventName).delete(callback);
    }
  }

  emitLocal(eventName, data) {
    if (this.listeners.has(eventName)) {
      this.listeners.get(eventName).forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          console.error(`[Signaling] Listener error on ${eventName}:`, e);
        }
      });
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.currentRoomId = null;
    }
  }
}

export const signalingService = new SignalingService();
