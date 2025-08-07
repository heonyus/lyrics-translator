const { createServer } = require('http');
const { Server } = require('socket.io');
const net = require('net');

const DESIRED_PORT = parseInt(process.env.WEBSOCKET_PORT, 10) || 3005;

// Create HTTP server
const httpServer = createServer();

// Create Socket.IO server
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
});

// Store rooms and participants
const rooms = new Map();
const userSocketMap = new Map();

// Generate room ID
function generateRoomId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let roomId = '';
  for (let i = 0; i < 6; i++) {
    roomId += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return roomId;
}

// Socket.IO event handlers
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Create room
  socket.on('create_room', (data) => {
    const roomId = generateRoomId();
    const roomState = {
      roomId,
      hostId: data.hostId,
      participants: new Map(),
      currentLyrics: null,
      playbackState: {
        isPlaying: false,
        currentLineIndex: 0,
        currentWordIndex: 0,
        timestamp: 0,
        playbackSpeed: 1,
      },
      settings: {
        targetLanguage: 'en',
        showOriginal: true,
        showTranslation: true,
        fontSize: 'medium',
        theme: 'neon',
      },
    };

    // Add host
    roomState.participants.set(socket.id, {
      id: socket.id,
      nickname: data.nickname,
      role: 'host',
      joinedAt: new Date(),
      isActive: true,
    });

    rooms.set(roomId, roomState);
    userSocketMap.set(socket.id, roomId);
    
    socket.join(roomId);
    
    // Convert Map to array for serialization
    const serializedState = {
      ...roomState,
      participants: Array.from(roomState.participants.entries()),
    };
    
    socket.emit('room_created', {
      roomId,
      roomState: serializedState,
    });

    console.log(`Room created: ${roomId} by ${data.nickname}`);
  });

  // Join room
  socket.on('join_room', (data) => {
    const room = rooms.get(data.roomId);
    
    if (!room) {
      socket.emit('error', { message: '방을 찾을 수 없습니다.' });
      return;
    }

    // Add participant
    const participant = {
      id: socket.id,
      nickname: data.nickname,
      role: 'viewer',
      joinedAt: new Date(),
      isActive: true,
      preferredLanguage: data.preferredLanguage,
    };
    
    room.participants.set(socket.id, participant);
    userSocketMap.set(socket.id, data.roomId);
    socket.join(data.roomId);

    // Send current state
    const serializedState = {
      ...room,
      participants: Array.from(room.participants.entries()),
    };
    
    socket.emit('room_joined', {
      roomState: serializedState,
    });

    // Notify other participants
    socket.to(data.roomId).emit('participant_joined', {
      participant,
    });

    console.log(`${data.nickname} joined room: ${data.roomId}`);
  });

  // Sync playback
  socket.on('sync_playback', (data) => {
    const room = rooms.get(data.roomId);
    if (!room) return;

    const participant = room.participants.get(socket.id);
    if (participant?.role !== 'host') {
      socket.emit('error', { message: '호스트만 재생을 제어할 수 있습니다.' });
      return;
    }

    room.playbackState = data.playbackState;
    
    // Sync to all participants
    io.to(data.roomId).emit('playback_updated', {
      playbackState: room.playbackState,
    });
  });

  // Change lyrics
  socket.on('change_lyrics', (data) => {
    const room = rooms.get(data.roomId);
    if (!room) return;

    const participant = room.participants.get(socket.id);
    if (participant?.role !== 'host') {
      socket.emit('error', { message: '호스트만 가사를 변경할 수 있습니다.' });
      return;
    }

    // For now, just store the lyrics ID
    room.currentLyrics = {
      id: data.lyricsId,
      title: data.title || 'Unknown',
      artist: data.artist || 'Unknown',
      lines: data.lines || [],
    };
    
    room.playbackState = {
      isPlaying: false,
      currentLineIndex: 0,
      currentWordIndex: 0,
      timestamp: 0,
      playbackSpeed: 1,
    };

    io.to(data.roomId).emit('lyrics_changed', {
      lyrics: room.currentLyrics,
      playbackState: room.playbackState,
    });
  });

  // Update settings
  socket.on('update_settings', (data) => {
    const room = rooms.get(data.roomId);
    if (!room) return;

    const participant = room.participants.get(socket.id);
    if (participant?.role !== 'host') {
      socket.emit('error', { message: '호스트만 설정을 변경할 수 있습니다.' });
      return;
    }

    room.settings = { ...room.settings, ...data.settings };
    
    io.to(data.roomId).emit('settings_updated', {
      settings: room.settings,
    });
  });

  // Send message
  socket.on('send_message', (data) => {
    const room = rooms.get(data.roomId);
    if (!room) return;

    const participant = room.participants.get(socket.id);
    if (!participant) return;

    io.to(data.roomId).emit('message_received', {
      from: participant.nickname,
      message: data.message,
      timestamp: new Date(),
    });
  });

  // Disconnect
  socket.on('disconnect', () => {
    const roomId = userSocketMap.get(socket.id);
    
    if (roomId) {
      const room = rooms.get(roomId);
      
      if (room) {
        const participant = room.participants.get(socket.id);
        
        if (participant) {
          // Host leaving closes the room
          if (participant.role === 'host') {
            io.to(roomId).emit('room_closed', {
              reason: '호스트가 방을 나갔습니다.',
            });
            
            // Remove all participants
            room.participants.forEach((_, socketId) => {
              userSocketMap.delete(socketId);
            });
            
            rooms.delete(roomId);
            console.log(`Room ${roomId} closed - host disconnected`);
          } else {
            // Remove viewer
            room.participants.delete(socket.id);
            socket.to(roomId).emit('participant_left', {
              participantId: socket.id,
              nickname: participant.nickname,
            });
          }
        }
      }
      
      userSocketMap.delete(socket.id);
    }
    
    console.log(`Client disconnected: ${socket.id}`);
  });

  // Heartbeat
  socket.on('heartbeat', () => {
    socket.emit('heartbeat_ack');
  });
});

// Probe for a free port starting from DESIRED_PORT to DESIRED_PORT+20
function findAvailablePort(startPort, maxOffset = 20) {
  return new Promise((resolve) => {
    const tryPort = (port, offset) => {
      const tester = net.createServer()
        .once('error', (err) => {
          if (err && err.code === 'EADDRINUSE' && offset < maxOffset) {
            tryPort(port + 1, offset + 1);
          } else {
            // fallback to OS-assigned random port
            resolve(0);
          }
        })
        .once('listening', () => {
          tester.close(() => resolve(port));
        })
        .listen(port, '0.0.0.0');
    };
    tryPort(startPort, 0);
  });
}

(async () => {
  const chosen = await findAvailablePort(DESIRED_PORT, 20);
  const finalPort = chosen || 0; // 0 lets OS choose a free ephemeral port
  httpServer.listen(finalPort, () => {
    const address = httpServer.address();
    const effectivePort = typeof address === 'object' && address ? address.port : finalPort;
    if (effectivePort !== DESIRED_PORT) {
      console.log(`⚠ WebSocket desired port ${DESIRED_PORT} unavailable. Using ${effectivePort} instead.`);
    }
    console.log(`🚀 WebSocket server running on port ${effectivePort}`);
    console.log(`📡 Accepting connections from ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}`);
  });
})();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, closing server...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});