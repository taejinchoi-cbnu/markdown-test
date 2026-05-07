import type { AutomergeUrl } from "@automerge/automerge-repo";
import { SplitView } from "./components/SplitView";

export default function App({ docUrl }: { docUrl: AutomergeUrl }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <div style={{ flex: 1, overflow: "hidden" }}>
        <SplitView docUrl={docUrl} />
      </div>
    </div>
  );
}