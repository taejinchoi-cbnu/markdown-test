import * as Y from "yjs";
import { WebSocketServer } from "ws";
import * as awarenessProtocol from "y-protocols/awareness.js";

const wss = new WebSocketServer({ 
  port: 1234,
  host: "0.0.0.0"
});

const docs = new Map();
const awarenessStates = new Map();
const wsToClientIds = new Map(); // ws -> Set<number>
const connections = new Map();

function getDocAndAwareness(name) {
  if (!docs.has(name)) {
    const doc = new Y.Doc();
    const awareness = new awarenessProtocol.Awareness(doc);
    
    // Server listens to awareness updates and broadcasts them
    awareness.on("update", ({ added, updated, removed }, origin) => {
      // Track clientIDs for the WebSocket that sent the update (origin)
      if (origin && typeof origin !== "string") {
        let clientIds = wsToClientIds.get(origin);
        if (!clientIds) {
          clientIds = new Set();
          wsToClientIds.set(origin, clientIds);
        }
        added.forEach(id => clientIds.add(id));
        updated.forEach(id => clientIds.add(id));
        removed.forEach(id => clientIds.delete(id));
      }

      const changedClients = added.concat(updated, removed);
      const update = awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients);
      
      wss.clients.forEach(client => {
        if (client !== origin && connections.get(client) === name && client.readyState === 1) {
          client.send(JSON.stringify({ type: "awareness", update: Array.from(update) }));
        }
      });
    });

    docs.set(name, doc);
    awarenessStates.set(name, awareness);
  }
  return { doc: docs.get(name), awareness: awarenessStates.get(name) };
}

wss.on("connection", (ws) => {
  let roomName = null;

  const broadcast = (msg, excludeWs) => {
    wss.clients.forEach(client => {
      if (client !== excludeWs && connections.get(client) === roomName && client.readyState === 1) {
        client.send(JSON.stringify(msg));
      }
    });
  };

  ws.on("message", (message) => {
    try {
      const msg = JSON.parse(message.toString());

      if (msg.type === "join") {
        roomName = msg.doc;
        connections.set(ws, roomName);
        const { doc, awareness } = getDocAndAwareness(roomName);

        // 초기 상태 전송
        const state = Y.encodeStateAsUpdate(doc);
        ws.send(
          JSON.stringify({
            type: "sync",
            update: Array.from(state),
          })
        );

        // 현재 Awareness 상태 전송 (Fix 1)
        const awarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(awareness, Array.from(awareness.getStates().keys()));
        ws.send(
          JSON.stringify({
            type: "awareness",
            update: Array.from(awarenessUpdate),
          })
        );

        console.log(`[SERVER] User joined room: ${roomName}`);
      } else if (msg.type === "update") {
        if (roomName) {
          const doc = docs.get(roomName);
          const update = new Uint8Array(msg.update);
          Y.applyUpdate(doc, update);
          broadcast({ type: "update", update: msg.update }, ws);
        }
      } else if (msg.type === "awareness") {
        if (roomName) {
          const awareness = awarenessStates.get(roomName);
          const update = new Uint8Array(msg.update);
          // applyAwarenessUpdate will trigger the "update" event above
          awarenessProtocol.applyAwarenessUpdate(awareness, update, ws);
        }
      }
    } catch (e) {
      console.error("Failed to parse message", e);
    }
  });

  ws.on("close", () => {
    const room = connections.get(ws);
    connections.delete(ws);
    
    // Clean up awareness (Fix 2)
    const clientIds = wsToClientIds.get(ws);
    if (clientIds && room) {
      const awareness = awarenessStates.get(room);
      if (awareness) {
        awarenessProtocol.removeAwarenessStates(awareness, Array.from(clientIds), ws);
      }
    }
    wsToClientIds.delete(ws);
    
    console.log(`User left room: ${roomName}`);
  });
});

console.log("Yjs WebSocket server running on ws://localhost:1234");
