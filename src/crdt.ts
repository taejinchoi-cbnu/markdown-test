import * as Y from "yjs";
import {
  Awareness,
  encodeAwarenessUpdate,
  applyAwarenessUpdate,
} from "y-protocols/awareness";

export const ROOM_NAME = "room1";

export const doc = new Y.Doc();
export const yText = doc.getText("codemirror");
export const awareness = new Awareness(doc);

// 사용자 정보 설정 (랜덤 이름 및 색상)
const NAMES = ["user1", "user2", "uesr3", "user4", "user5"];
const COLORS = [
  { main: "#ff7b72", light: "#ff7b7233" },
  { main: "#a5d6ff", light: "#a5d6ff33" },
  { main: "#aff5b4", light: "#aff5b433" },
  { main: "#d2a8ff", light: "#d2a8ff33" },
  { main: "#ffa657", light: "#ffa65733" },
];
const random = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const userColor = random(COLORS);
awareness.setLocalStateField("user", {
  name: random(NAMES),
  color: userColor.main,
  colorLight: userColor.light,
});

const ws = new WebSocket("ws://localhost:1234");

ws.onopen = () => {
  ws.send(
    JSON.stringify({
      type: "join",
      doc: ROOM_NAME,
    })
  );
};

// 서버 -> 클라이언트
ws.onmessage = (event) => {
  try {
    const msg = JSON.parse(event.data);
    console.log("[CRDT] Received message:", msg.type);

    if (msg.type === "sync" || msg.type === "update") {
      const update = new Uint8Array(msg.update);
      Y.applyUpdate(doc, update, "server");
      console.log("[CRDT] Applied update. Doc text:", yText.toString());
      
    } else if (msg.type === "awareness") {
      const update = new Uint8Array(msg.update);
      applyAwarenessUpdate(awareness, update, "server");
      console.log("[CRDT] Applied awareness update.");
    }
  } catch (e) {
    console.error("Failed to handle ws message", e);
  }
};

// 로컬 Doc -> 서버
doc.on("update", (update: Uint8Array, origin: unknown) => {
  if (origin === "server") return;
  console.log("[CRDT] Sending update to server...");
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        type: "update",
        update: Array.from(update),
      })
    );
  }
});

// 로컬 Awareness -> 서버
awareness.on(
  "update",
  (
    {
      added,
      updated,
      removed,
    }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown
  ) => {
    if (origin === "server") return;
    console.log("[CRDT] Sending awareness to server...");
    const changedClients = added.concat(updated).concat(removed);
    const update = encodeAwarenessUpdate(awareness, changedClients);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: "awareness",
          update: Array.from(update),
        })
      );
    }
  }
);
