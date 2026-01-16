// canvas.js - Canvas Drawing Logic

class CanvasManager {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d', { willReadFrequently: true });
    
    // Drawing state
    this.isDrawing = false;
    this.currentPath = [];
    this.lastPoint = null;
    
    // Tool settings
    this.tool = 'brush';
    this.color = '#000000';
    this.strokeWidth = 3;
    
    // Operations history
    this.operations = [];
    this.currentOperationIndex = -1;
    
    this.initCanvas();
    this.setupEventListeners();
  }

  initCanvas() {
    // Set canvas size
    const container = this.canvas.parentElement;
    const rect = container.getBoundingClientRect();
    
    // Set display size
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    
    // Set actual size (for drawing)
    this.canvas.width = this.canvas.offsetWidth;
    this.canvas.height = this.canvas.offsetHeight;
    
    // Fill with white background
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Set default styles
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
  }

  setupEventListeners() {
    // Mouse events
    this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
    this.canvas.addEventListener('mousemove', (e) => this.draw(e));
    this.canvas.addEventListener('mouseup', () => this.stopDrawing());
    this.canvas.addEventListener('mouseleave', () => this.stopDrawing());
    
    // Touch events for mobile
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      this.canvas.dispatchEvent(mouseEvent);
    });
    
    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      this.canvas.dispatchEvent(mouseEvent);
    });
    
    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      const mouseEvent = new MouseEvent('mouseup', {});
      this.canvas.dispatchEvent(mouseEvent);
    });

    // Window resize
    window.addEventListener('resize', () => this.handleResize());
  }

  getCoordinates(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  startDrawing(e) {
    const point = this.getCoordinates(e);
    this.isDrawing = true;
    this.currentPath = [point];
    this.lastPoint = point;
    
    // Start new path
    this.ctx.strokeStyle = this.tool === 'eraser' ? '#FFFFFF' : this.color;
    this.ctx.lineWidth = this.strokeWidth;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    
    this.ctx.beginPath();
    this.ctx.moveTo(point.x, point.y);
  }

  draw(e) {
    const point = this.getCoordinates(e);
    
    // Emit cursor position for other users
    if (window.websocketManager) {
      window.websocketManager.sendCursorPosition(point);
    }
    
    if (!this.isDrawing || !this.lastPoint) return;
    
    // Draw line segment
    this.ctx.strokeStyle = this.tool === 'eraser' ? '#FFFFFF' : this.color;
    this.ctx.lineWidth = this.strokeWidth;
    
    this.ctx.lineTo(point.x, point.y);
    this.ctx.stroke();
    
    // Add to current path
    this.currentPath.push(point);
    this.lastPoint = point;
  }

  stopDrawing() {
    if (!this.isDrawing || this.currentPath.length < 2) {
      this.isDrawing = false;
      this.currentPath = [];
      this.lastPoint = null;
      return;
    }
    
    // Create operation
    const operation = {
      id: `op-${Date.now()}-${Math.random()}`,
      userId: window.websocketManager?.userId || 'local',
      event: {
        type: this.tool === 'eraser' ? 'erase' : 'draw',
        points: [...this.currentPath],
        color: this.color,
        width: this.strokeWidth,
        userId: window.websocketManager?.userId || 'local',
        timestamp: Date.now()
      },
      timestamp: Date.now()
    };
    
    // Add to local history
    this.addOperation(operation);
    
    // Send to server
    if (window.websocketManager) {
      window.websocketManager.sendDrawEvent(operation);
    }
    
    // Reset state
    this.isDrawing = false;
    this.currentPath = [];
    this.lastPoint = null;
  }

  addOperation(operation) {
    // Remove operations after current index (for redo)
    this.operations = this.operations.slice(0, this.currentOperationIndex + 1);
    this.operations.push(operation);
    this.currentOperationIndex = this.operations.length - 1;
    
    this.updateStats();
  }

  drawOperation(event) {
    if (!event || !event.points || event.points.length < 2) return;
    
    this.ctx.strokeStyle = event.type === 'erase' ? '#FFFFFF' : event.color;
    this.ctx.lineWidth = event.width;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    
    this.ctx.beginPath();
    this.ctx.moveTo(event.points[0].x, event.points[0].y);
    
    for (let i = 1; i < event.points.length; i++) {
      this.ctx.lineTo(event.points[i].x, event.points[i].y);
    }
    
    this.ctx.stroke();
  }

  redrawCanvas(operations) {
    // Clear canvas
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Redraw all operations
    operations.forEach(op => {
      this.drawOperation(op.event);
    });
  }

  undo() {
    if (this.currentOperationIndex < 0) return;
    
    this.currentOperationIndex--;
    const visibleOperations = this.operations.slice(0, this.currentOperationIndex + 1);
    this.redrawCanvas(visibleOperations);
    
    // Notify server
    if (window.websocketManager) {
      window.websocketManager.sendUndo();
    }
    
    this.updateStats();
  }

  redo() {
    if (this.currentOperationIndex >= this.operations.length - 1) return;
    
    this.currentOperationIndex++;
    const visibleOperations = this.operations.slice(0, this.currentOperationIndex + 1);
    this.redrawCanvas(visibleOperations);
    
    // Notify server
    if (window.websocketManager) {
      window.websocketManager.sendRedo();
    }
    
    this.updateStats();
  }

  clear() {
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.operations = [];
    this.currentOperationIndex = -1;
    
    // Notify server
    if (window.websocketManager) {
      window.websocketManager.sendClear();
    }
    
    this.updateStats();
  }

  setTool(tool) {
    this.tool = tool;
  }

  setColor(color) {
    this.color = color;
  }

  setStrokeWidth(width) {
    this.strokeWidth = width;
  }

  handleResize() {
    // Save current canvas content
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    
    // Resize canvas
    this.canvas.width = this.canvas.offsetWidth;
    this.canvas.height = this.canvas.offsetHeight;
    
    // Restore content
    this.ctx.putImageData(imageData, 0, 0);
    
    // Restore styles
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
  }

  updateStats() {
    const operationCount = document.getElementById('operationCount');
    const operationPosition = document.getElementById('operationPosition');
    
    if (operationCount) {
      operationCount.textContent = this.operations.length;
    }
    if (operationPosition) {
      operationPosition.textContent = this.currentOperationIndex + 1;
    }
  }

  // Load initial state from server
  loadState(state) {
    if (state.operations && state.operations.length > 0) {
      this.operations = state.operations;
      this.currentOperationIndex = state.operations.length - 1;
      this.redrawCanvas(this.operations);
    }
  }
}