// main.js - Application Initialization

let canvasManager;
let websocketManager;

// Initialize application
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🎨 Initializing Collaborative Canvas...');
  
  try {
    // Initialize canvas
    const canvas = document.getElementById('canvas');
    canvasManager = new CanvasManager(canvas);
    console.log('✅ Canvas initialized');
    
    // Initialize WebSocket
    websocketManager = new WebSocketManager();
    websocketManager.setCanvasManager(canvasManager);
    window.websocketManager = websocketManager;
    
    await websocketManager.connect();
    console.log('✅ WebSocket connected');
    
    // Setup UI controls
    setupControls();
    console.log('✅ Controls initialized');
    
    console.log('🎉 Application ready!');
    
  } catch (error) {
    console.error('❌ Initialization error:', error);
    showError('Failed to connect to server. Please refresh the page.');
  }
});

// Setup UI controls
function setupControls() {
  // Tool buttons
  const brushTool = document.getElementById('brushTool');
  const eraserTool = document.getElementById('eraserTool');
  
  brushTool.addEventListener('click', () => {
    canvasManager.setTool('brush');
    brushTool.classList.add('active');
    eraserTool.classList.remove('active');
  });
  
  eraserTool.addEventListener('click', () => {
    canvasManager.setTool('eraser');
    eraserTool.classList.add('active');
    brushTool.classList.remove('active');
  });
  
  // Color palette
  const colorButtons = document.querySelectorAll('.color-btn');
  colorButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const color = btn.dataset.color;
      canvasManager.setColor(color);
      
      // Update active state
      colorButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  
  // Stroke width
  const strokeWidth = document.getElementById('strokeWidth');
  const widthValue = document.getElementById('widthValue');
  
  strokeWidth.addEventListener('input', (e) => {
    const width = parseInt(e.target.value);
    canvasManager.setStrokeWidth(width);
    widthValue.textContent = `${width}px`;
  });
  
  // Undo/Redo
  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');
  
  undoBtn.addEventListener('click', () => {
    canvasManager.undo();
  });
  
  redoBtn.addEventListener('click', () => {
    canvasManager.redo();
  });
  
  // Clear canvas
  const clearBtn = document.getElementById('clearBtn');
  clearBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear the canvas? This will clear it for all users.')) {
      canvasManager.clear();
    }
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Z for undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      canvasManager.undo();
    }
    
    // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y for redo
    if ((e.ctrlKey || e.metaKey) && (e.shiftKey && e.key === 'z' || e.key === 'y')) {
      e.preventDefault();
      canvasManager.redo();
    }
    
    // B for brush
    if (e.key === 'b' || e.key === 'B') {
      brushTool.click();
    }
    
    // E for eraser
    if (e.key === 'e' || e.key === 'E') {
      eraserTool.click();
    }
    
    // Number keys for colors (1-7)
    if (e.key >= '1' && e.key <= '7') {
      const index = parseInt(e.key) - 1;
      colorButtons[index]?.click();
    }
  });
}

// Show error message
function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #ef4444;
    color: white;
    padding: 1rem 2rem;
    border-radius: 0.5rem;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    z-index: 10000;
    font-weight: 500;
  `;
  errorDiv.textContent = message;
  document.body.appendChild(errorDiv);
  
  setTimeout(() => {
    errorDiv.remove();
  }, 5000);
}

// Show success message
function showSuccess(message) {
  const successDiv = document.createElement('div');
  successDiv.className = 'success-message';
  successDiv.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #10b981;
    color: white;
    padding: 1rem 2rem;
    border-radius: 0.5rem;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    z-index: 10000;
    font-weight: 500;
  `;
  successDiv.textContent = message;
  document.body.appendChild(successDiv);
  
  setTimeout(() => {
    successDiv.remove();
  }, 3000);
}

// Handle page unload
window.addEventListener('beforeunload', () => {
  if (websocketManager) {
    websocketManager.disconnect();
  }
});

// Export for debugging
window.canvasManager = canvasManager;
window.websocketManager = websocketManager;