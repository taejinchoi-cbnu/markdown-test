import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { Repo, RepoContext } from "@automerge/react";
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";
import { isValidAutomergeUrl } from "@automerge/automerge-repo";
import App from "./App.tsx";
import "./index.css";

const repo = new Repo({
  network: [new BrowserWebSocketClientAdapter("ws://localhost:3030")],
});

const docUrl = import.meta.env.VITE_DOC_URL;
if (!isValidAutomergeUrl(docUrl)) {
  throw new Error("VITE_DOC_URL 누락/형식오류 — 서버 콘솔 출력을 .env.local 에 넣으세요");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RepoContext.Provider value={repo}>
      <Suspense fallback={<div>loading…</div>}>
        <App docUrl={docUrl} />
      </Suspense>
    </RepoContext.Provider>
  </StrictMode>,
);