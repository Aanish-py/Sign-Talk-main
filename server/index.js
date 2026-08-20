import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins for local dev and local network devices
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5000;

// Track active rooms: { [roomId]: Set<string socketId> }
const rooms = new Map();
const socketUserMap = new Map(); // socketId -> { userId, roomId, role }

// Health Check API
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'SignSpeak WebRTC Signaling Server',
    activeRooms: rooms.size,
    timestamp: new Date().toISOString()
  });
});

io.on('connection', (socket) => {
  console.log(`[Socket] Peer connected: ${socket.id}`);

  // Join Room
  socket.on('join-room', ({ roomId, userId, role }) => {
    if (!roomId) return;

    // Leave any previous room
    if (socketUserMap.has(socket.id)) {
      const prev = socketUserMap.get(socket.id);
      socket.leave(prev.roomId);
      const prevRoom = rooms.get(prev.roomId);
      if (prevRoom) {
        prevRoom.delete(socket.id);
        if (prevRoom.size === 0) rooms.delete(prev.roomId);
      }
    }

    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }

    const roomSet = rooms.get(roomId);
    
    // Check existing peers in room
    const existingPeers = [];
    roomSet.forEach((peerSocketId) => {
      const peerData = socketUserMap.get(peerSocketId);
      if (peerData) {
        existingPeers.push({
          socketId: peerSocketId,
          userId: peerData.userId,
          role: peerData.role
        });
      }
    });

    roomSet.add(socket.id);
    socketUserMap.set(socket.id, { userId: userId || socket.id, roomId, role: role || 'unified' });

    console.log(`[Socket] User ${userId || socket.id} (${role}) joined room: ${roomId} (Total in room: ${roomSet.size})`);

    // Acknowledge joining to the sender
    socket.emit('room-joined', {
      roomId,
      existingPeers,
      socketId: socket.id
    });

    // Notify other peers in room
    socket.to(roomId).emit('user-connected', {
      socketId: socket.id,
      userId: userId || socket.id,
      role: role || 'unified'
    });
  });

  // Relay WebRTC Offer
  socket.on('offer', ({ targetSocketId, sdp, roomId }) => {
    if (targetSocketId) {
      io.to(targetSocketId).emit('offer', {
        senderSocketId: socket.id,
        sdp
      });
    } else if (roomId) {
      socket.to(roomId).emit('offer', {
        senderSocketId: socket.id,
        sdp
      });
    }
  });

  // Relay WebRTC Answer
  socket.on('answer', ({ targetSocketId, sdp, roomId }) => {
    if (targetSocketId) {
      io.to(targetSocketId).emit('answer', {
        senderSocketId: socket.id,
        sdp
      });
    } else if (roomId) {
      socket.to(roomId).emit('answer', {
        senderSocketId: socket.id,
        sdp
      });
    }
  });

  // Relay ICE Candidate
  socket.on('ice-candidate', ({ targetSocketId, candidate, roomId }) => {
    if (targetSocketId) {
      io.to(targetSocketId).emit('ice-candidate', {
        senderSocketId: socket.id,
        candidate
      });
    } else if (roomId) {
      socket.to(roomId).emit('ice-candidate', {
        senderSocketId: socket.id,
        candidate
      });
    }
  });

  // Fallback Signaling Relay for Recognized Signs
  socket.on('sign-event', ({ roomId, sign }) => {
    if (roomId) {
      socket.to(roomId).emit('remote-sign-event', {
        senderSocketId: socket.id,
        sign,
        timestamp: Date.now()
      });
    }
  });

  // Fallback Signaling Relay for Speech Captions
  socket.on('speech-transcript', ({ roomId, transcript, isFinal }) => {
    if (roomId) {
      socket.to(roomId).emit('remote-speech-transcript', {
        senderSocketId: socket.id,
        transcript,
        isFinal,
        timestamp: Date.now()
      });
    }
  });

  // Chat message relay
  socket.on('chat-message', ({ roomId, message, senderName }) => {
    if (roomId && message) {
      const msgObj = {
        id: Date.now() + Math.random().toString(36).substring(2, 7),
        senderSocketId: socket.id,
        senderName: senderName || 'Peer',
        text: message,
        timestamp: new Date().toLocaleTimeString()
      };
      io.to(roomId).emit('chat-message', msgObj);
    }
  });

  // Handle Disconnect
  socket.on('disconnect', () => {
    console.log(`[Socket] Peer disconnected: ${socket.id}`);
    const userData = socketUserMap.get(socket.id);
    if (userData) {
      const { roomId, userId } = userData;
      socket.to(roomId).emit('user-disconnected', {
        socketId: socket.id,
        userId
      });

      const roomSet = rooms.get(roomId);
      if (roomSet) {
        roomSet.delete(socket.id);
        if (roomSet.size === 0) {
          rooms.delete(roomId);
        }
      }
      socketUserMap.delete(socket.id);
    }
  });
});

server.listen(PORT, () => {
  console.log(`=============================================`);
  console.log(`🚀 SignSpeak Signaling Server running on port ${PORT}`);
  console.log(`📡 Healthcheck: http://localhost:${PORT}/health`);
  console.log(`=============================================`);
});
