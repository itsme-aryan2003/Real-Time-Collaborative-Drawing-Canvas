# 🧠 Architecture & System Design

This document explains the architecture, data flow, and design decisions behind the **Real-Time Collaborative Drawing Canvas** application.

The goal of the system is to allow multiple users to draw simultaneously on a shared canvas with **real-time synchronization, global undo/redo, and consistent state across all clients**.

---

## 🏗 High-Level Architecture

+------------+ WebSocket +-------------+
| Client A | <------------------> | |
+------------+ | |
| |
+------------+ WebSocket | Server |
| Client B | <------------------> | (Socket.io) |
+------------+ | |
| |
+------------+ WebSocket | |
| Client C | <------------------> | |
+------------+ +-------------+


- The **server is authoritative**
- Clients send drawing actions as events
- The server stores and orders operations
- Updates are broadcast to all connected users in the same room

---

## 🔌 Communication Layer

### Why Socket.io?
- Built on WebSockets with automatic fallback
- Handles reconnection, heartbeat, and room management
- Simplifies real-time event broadcasting

Socket.io is used strictly for **event streaming**, not state computation.

---

## 📡 WebSocket Event Protocol

### Client → Server Events

| Event Name | Description |
|----------|------------|
| `room:join` | Join a specific drawing room |
| `draw:event` | Send drawing or erasing data |
| `cursor:move` | Send live cursor position |
| `operation:undo` | Request global undo |
| `operation:redo` | Request global redo |
| `canvas:clear` | Clear canvas for all users |

---

### Server → Client Events

| Event Name | Description |
|----------|------------|
| `room:state` | Initial canvas state + user list |
| `draw:event` | Broadcast drawing operations |
| `cursor:move` | Broadcast cursor movement |
| `operation:undo` | Apply global undo |
| `operation:redo` | Apply global redo |
| `users:update` | Update list of connected users |

---

## ✏️ Drawing Data Model

Each drawing action is stored as a **canvas operation**:

```js
{
  id: "op-unique-id",
  userId: "user-id",
  event: {
    type: "draw" | "erase",
    points: [{ x, y }, ...],
    color: "#000000",
    width: 3,
    timestamp: 1710000000
  },
  timestamp: 1710000000
}
