# 🎨 Real-Time Collaborative Drawing Canvas

A real-time, multi-user collaborative drawing application where multiple users can draw simultaneously on a shared canvas with live synchronization.

This project is built using **Node.js, Socket.io, and the HTML5 Canvas API**, without relying on any external drawing libraries.

---

## 🚀 Features

- Real-time multi-user drawing
- Brush and eraser tools
- Color selection and stroke width adjustment
- Live cursor indicators for all users
- Global undo / redo across all users
- Room-based canvas isolation
- Mobile touch support
- Automatic reconnection handling
- Latency monitoring (ping/pong)

---

## 🧱 Tech Stack

### Frontend
- HTML5
- CSS3
- Vanilla JavaScript
- HTML Canvas API

### Backend
- Node.js
- Express
- Socket.io (WebSockets)

---

## 📁 Project Structure

collaborative-canvas/
├── client/
│ ├── index.html
│ ├── style.css
│ ├── canvas.js # Canvas drawing logic
│ ├── websocket.js # WebSocket client
│ └── main.js # App initialization
├── server.js # Express + Socket.io server
├── package.json
├── README.md
└── ARCHITECTURE.md


---

## ⚙️ Setup Instructions

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd collaborative-canvas

2. Install dependencies
npm install 

3. Start the server
npm start



The application will be available at:
http://localhost:3000
 