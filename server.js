// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// In-memory storage for rooms and drawing state
const rooms = new Map();
const users = new Map();

// Room class to manage canvas state
class Room {
  constructor(roomId) {
    this.roomId = roomId;
    this.operations = [];
    this.users = new Map();
    this.currentOperationIndex = -1;
  }

  addOperation(operation) {
    this.operations = this.operations.slice(0, this.currentOperationIndex + 1);
    this.operations.push(operation);
    this.currentOperationIndex = this.operations.length - 1;
    return operation;
  }

  undo() {
    if (this.currentOperationIndex < 0) return null;
    const operation = this.operations[this.currentOperationIndex];
    this.currentOperationIndex--;
    return operation;
  }

  redo() {
    if (this.currentOperationIndex >= this.operations.length - 1) return null;
    this.currentOperationIndex++;
    return this.operations[this.currentOperationIndex];
  }

  getOperations() {
    return this.operations.slice(0, this.currentOperationIndex + 1);
  }

  addUser(userId, userData) {
    this.users.set(userId, userData);
  }

  removeUser(userId) {
    this.users.delete(userId);
  }

  getUsers() {
    return Array.from(this.users.values());
  }

  clear() {
    this.operations = [];
    this.currentOperationIndex = -1;
  }
}

// Get or create room
function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Room(roomId));
  }
  return rooms.get(roomId);
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`[${new Date().toISOString()}] User connected: ${socket.id}`);
  
  let currentRoom = 'default';
  let currentUser = null;

  // Join room
  socket.on('room:join', (data) => {
    const { roomId = 'default', userId, userData } = data;
    
    socket.leave(currentRoom);
    currentRoom = roomId;
    socket.join(roomId);
    
    const room = getRoom(roomId);
    
    currentUser = {
      id: userId || socket.id,
      socketId: socket.id,
      ...userData
    };
    
    room.addUser(currentUser.id, currentUser);
    users.set(socket.id, currentUser);
    
    console.log(`User ${currentUser.id} joined room ${roomId}`);
    
    socket.emit('room:state', {
      operations: room.getOperations(),
      users: room.getUsers()
    });
    
    socket.to(roomId).emit('user:joined', currentUser);
    io.to(roomId).emit('users:update', room.getUsers());
  });

  // Drawing event
  socket.on('draw:event', (operation) => {
    const room = getRoom(currentRoom);
    
    if (!operation.timestamp) {
      operation.timestamp = Date.now();
    }
    
    const savedOperation = room.addOperation(operation);
    socket.to(currentRoom).emit('draw:event', savedOperation);
    
    console.log(`Drawing event from ${operation.userId} in room ${currentRoom}`);
  });

  // Cursor movement
  socket.on('cursor:move', (data) => {
    socket.to(currentRoom).emit('cursor:move', data);
  });

  // Undo operation
  socket.on('operation:undo', (data) => {
    const room = getRoom(currentRoom);
    const undoneOperation = room.undo();
    
    if (undoneOperation) {
      io.to(currentRoom).emit('operation:undo', {
        operationId: undoneOperation.id,
        currentIndex: room.currentOperationIndex
      });
      
      console.log(`Undo operation ${undoneOperation.id} in room ${currentRoom}`);
    }
  });

  // Redo operation
  socket.on('operation:redo', (data) => {
    const room = getRoom(currentRoom);
    const redoneOperation = room.redo();
    
    if (redoneOperation) {
      io.to(currentRoom).emit('operation:redo', {
        operationId: redoneOperation.id,
        currentIndex: room.currentOperationIndex
      });
      
      console.log(`Redo operation ${redoneOperation.id} in room ${currentRoom}`);
    }
  });

  // Clear canvas
  socket.on('canvas:clear', () => {
    const room = getRoom(currentRoom);
    room.clear();
    io.to(currentRoom).emit('canvas:clear');
    console.log(`Canvas cleared in room ${currentRoom}`);
  });

  // Ping for latency
  socket.on('ping', (timestamp) => {
    socket.emit('pong', timestamp);
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    
    if (currentUser) {
      const room = getRoom(currentRoom);
      room.removeUser(currentUser.id);
      users.delete(socket.id);
      
      socket.to(currentRoom).emit('user:left', currentUser);
      io.to(currentRoom).emit('users:update', room.getUsers());
      
      console.log(`User ${currentUser.id} left room ${currentRoom}`);
    }
    
    if (rooms.has(currentRoom)) {
      const room = rooms.get(currentRoom);
      if (room.users.size === 0) {
        rooms.delete(currentRoom);
        console.log(`Room ${currentRoom} deleted (empty)`);
      }
    }
  });

  socket.on('error', (error) => {
    console.error(`Socket error for ${socket.id}:`, error);
  });
});

// REST API endpoints
app.get('/api/rooms', (req, res) => {
  const roomList = Array.from(rooms.entries()).map(([id, room]) => ({
    id,
    userCount: room.users.size,
    operationCount: room.operations.length
  }));
  res.json(roomList);
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    rooms: rooms.size,
    totalUsers: users.size
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  Collaborative Canvas Server                               ║
║  Server running on http://localhost:${PORT}                   ║
║  Socket.io enabled for real-time collaboration             ║
╚════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});