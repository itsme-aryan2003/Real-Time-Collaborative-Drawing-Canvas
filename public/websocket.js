// websocket.js - WebSocket Client Manager

class WebSocketManager {
  constructor(serverUrl = '') {
    this.socket = null;
    this.serverUrl = serverUrl;
    this.userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.roomId = 'default';
    this.users = new Map();
    this.canvasManager = null;
    this.pingInterval = null;
    this.lastPingTime = 0;
    
    // User color assignment
    this.userColors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', 
      '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'
    ];
    this.myColor = this.userColors[Math.floor(Math.random() * this.userColors.length)];
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        // Connect to Socket.io server
        this.socket = io(this.serverUrl, {
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: 5
        });

        this.socket.on('connect', () => {
          console.log('Connected to server:', this.socket.id);
          this.joinRoom();
          this.startPingMonitoring();
          resolve();
        });

        this.socket.on('disconnect', () => {
          console.log('Disconnected from server');
          this.updateConnectionStatus(false);
        });

        this.socket.on('connect_error', (error) => {
          console.error('Connection error:', error);
          reject(error);
        });

        this.setupEventListeners();
        
      } catch (error) {
        reject(error);
      }
    });
  }

  setupEventListeners() {
    // Room state received
    this.socket.on('room:state', (data) => {
      console.log('Received room state:', data);
      
      // Load canvas operations
      if (this.canvasManager && data.operations) {
        this.canvasManager.loadState({ operations: data.operations });
      }
      
      // Load users
      if (data.users) {
        data.users.forEach(user => {
          this.users.set(user.id, user);
        });
        this.updateUsersList();
      }
    });

    // User joined
    this.socket.on('user:joined', (user) => {
      console.log('User joined:', user);
      this.users.set(user.id, user);
      this.updateUsersList();
      this.showNotification(`${user.id.slice(-4)} joined`);
    });

    // User left
    this.socket.on('user:left', (user) => {
      console.log('User left:', user);
      this.users.delete(user.id);
      this.removeCursor(user.id);
      this.updateUsersList();
      this.showNotification(`${user.id.slice(-4)} left`);
    });

    // Users update
    this.socket.on('users:update', (users) => {
      this.users.clear();
      users.forEach(user => {
        this.users.set(user.id, user);
      });
      this.updateUsersList();
    });

    // Drawing event
    this.socket.on('draw:event', (operation) => {
      if (operation.userId !== this.userId && this.canvasManager) {
        this.canvasManager.addOperation(operation);
        this.canvasManager.drawOperation(operation.event);
      }
    });

    // Cursor movement
    this.socket.on('cursor:move', (data) => {
      if (data.userId !== this.userId) {
        this.updateRemoteCursor(data.userId, data.x, data.y);
      }
    });

    // Undo operation
    this.socket.on('operation:undo', (data) => {
      if (this.canvasManager) {
        this.canvasManager.currentOperationIndex = data.currentIndex;
        const visibleOps = this.canvasManager.operations.slice(0, data.currentIndex + 1);
        this.canvasManager.redrawCanvas(visibleOps);
        this.canvasManager.updateStats();
      }
    });

    // Redo operation
    this.socket.on('operation:redo', (data) => {
      if (this.canvasManager) {
        this.canvasManager.currentOperationIndex = data.currentIndex;
        const visibleOps = this.canvasManager.operations.slice(0, data.currentIndex + 1);
        this.canvasManager.redrawCanvas(visibleOps);
        this.canvasManager.updateStats();
      }
    });

    // Canvas clear
    this.socket.on('canvas:clear', () => {
      if (this.canvasManager) {
        this.canvasManager.operations = [];
        this.canvasManager.currentOperationIndex = -1;
        this.canvasManager.redrawCanvas([]);
        this.canvasManager.updateStats();
      }
    });
  }

  joinRoom(roomId = 'default') {
    this.roomId = roomId;
    this.socket.emit('room:join', {
      roomId: this.roomId,
      userId: this.userId,
      userData: {
        color: this.myColor,
        online: true
      }
    });
  }

  sendDrawEvent(operation) {
    this.socket.emit('draw:event', operation);
  }

  sendCursorPosition(point) {
    // Throttle cursor updates
    this.socket.emit('cursor:move', {
      userId: this.userId,
      x: point.x,
      y: point.y
    });
  }

  sendUndo() {
    this.socket.emit('operation:undo', {});
  }

  sendRedo() {
    this.socket.emit('operation:redo', {});
  }

  sendClear() {
    this.socket.emit('canvas:clear');
  }

  updateRemoteCursor(userId, x, y) {
    const cursorsContainer = document.getElementById('cursors');
    if (!cursorsContainer) return;

    let cursorEl = document.getElementById(`cursor-${userId}`);
    
    if (!cursorEl) {
      // Create new cursor element
      cursorEl = document.createElement('div');
      cursorEl.id = `cursor-${userId}`;
      cursorEl.className = 'remote-cursor';
      
      const user = this.users.get(userId);
      const color = user?.color || '#999';
      
      cursorEl.innerHTML = `
        <div class="cursor-dot" style="background-color: ${color}"></div>
        <div class="cursor-label" style="background-color: ${color}">
          User ${userId.slice(-4)}
        </div>
      `;
      
      cursorsContainer.appendChild(cursorEl);
    }
    
    // Update position
    const canvas = document.getElementById('canvas');
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / canvas.width;
    const scaleY = rect.height / canvas.height;
    
    cursorEl.style.left = `${rect.left + x * scaleX}px`;
    cursorEl.style.top = `${rect.top + y * scaleY}px`;
  }

  removeCursor(userId) {
    const cursorEl = document.getElementById(`cursor-${userId}`);
    if (cursorEl) {
      cursorEl.remove();
    }
  }

  updateUsersList() {
    const usersContainer = document.getElementById('usersContainer');
    const userCount = document.getElementById('userCount');
    
    if (userCount) {
      userCount.textContent = `${this.users.size} user${this.users.size !== 1 ? 's' : ''} online`;
    }
    
    if (!usersContainer) return;
    
    usersContainer.innerHTML = '';
    
    this.users.forEach(user => {
      const userEl = document.createElement('div');
      userEl.className = 'user-item';
      userEl.innerHTML = `
        <div class="user-color" style="background-color: ${user.color || '#999'}"></div>
        <span class="user-name">${user.id.slice(-4)}${user.id === this.userId ? ' (You)' : ''}</span>
      `;
      usersContainer.appendChild(userEl);
    });
  }

  updateConnectionStatus(connected) {
    const indicator = document.querySelector('.online-indicator');
    if (indicator) {
      indicator.style.background = connected ? '#4ade80' : '#ef4444';
    }
  }

  startPingMonitoring() {
    this.pingInterval = setInterval(() => {
      const start = Date.now();
      this.socket.emit('ping', start);
      
      this.socket.once('pong', () => {
        const latency = Date.now() - start;
        const latencyEl = document.getElementById('latency');
        if (latencyEl) {
          latencyEl.textContent = `${latency}ms`;
        }
      });
    }, 2000);
  }

  showNotification(message) {
    // Simple console notification (can be enhanced with toast notifications)
    console.log('📢', message);
  }

  setCanvasManager(canvasManager) {
    this.canvasManager = canvasManager;
  }

  disconnect() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}