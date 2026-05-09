import * as Y from "yjs";
import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ 
  port: 1234,
  host: "0.0.0.0"
});

const docs = new Map();

function getDoc(name) {
  if (!docs.has(name)) {
    docs.set(name, new Y.Doc());
  }
  return docs.get(name);
}

// 각 연결에 대한 정보(어떤 방에 있는지)를 저장하여 브로드캐스트 시 사용
const connections = new Map();

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
        const doc = getDoc(roomName);

        // 초기 상태 전송
        const state = Y.encodeStateAsUpdate(doc);
        ws.send(
          JSON.stringify({
            type: "sync",
            update: Array.from(state),
          })
        );

        console.log(`[SERVER] User joined room: ${roomName}`);
      } else if (msg.type === "update") {
        if (roomName) {
          const doc = getDoc(roomName);
          const update = new Uint8Array(msg.update);
          Y.applyUpdate(doc, update);
          console.log(`[SERVER] Broadcast update in ${roomName}`);
          // 다른 클라이언트에게 전달
          broadcast({ type: "update", update: msg.update }, ws);
        }
      } else if (msg.type === "awareness") {
        if (roomName) {
          console.log(`[SERVER] Broadcast awareness in ${roomName}`);
          // Awareness 데이터는 서버에 저장할 필요 없이 즉시 브로드캐스트
          broadcast({ type: "awareness", update: msg.update }, ws);
        }
      }
    } catch (e) {
      console.error("Failed to parse message", e);
    }
  });

  ws.on("close", () => {
    connections.delete(ws);
    console.log(`User left room: ${roomName}`);
  });
});

console.log("Yjs WebSocket server running on ws://localhost:1234");
