import { WebSocketServer } from "ws";
import { Repo } from "@automerge/automerge-repo";
import { NodeWSServerAdapter } from "@automerge/automerge-repo-network-websocket";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import fs from "node:fs";

const wss = new WebSocketServer({ port: 3030, host: "0.0.0.0" });
const repo = new Repo({
  network: [new NodeWSServerAdapter(wss)],
  storage: new NodeFSStorageAdapter("./.sync-data"),
});

// doc URL 부팅 시 1회 생성, 이후 .doc-url 파일에서 재사용
const URL_FILE = "./.sync-data/.doc-url";
let docUrl;
if (fs.existsSync(URL_FILE)) {
  docUrl = fs.readFileSync(URL_FILE, "utf8").trim();
  await repo.find(docUrl);            // 기존 doc 핸들 등록
} else {
  fs.mkdirSync("./.sync-data", { recursive: true });
  const handle = repo.create({ text: "# Hello\n\n" });
  docUrl = handle.url;
  fs.writeFileSync(URL_FILE, docUrl);
}

console.log(`automerge sync ws://localhost:3030`);
console.log(`doc url: ${docUrl} → .env.local 에 VITE_DOC_URL=${docUrl} 넣기`);
