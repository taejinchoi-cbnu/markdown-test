import { useDocument } from "@automerge/react";
import type { AutomergeUrl } from "@automerge/automerge-repo";
import { Editor } from "./Editor";
import { Preview } from "./Preview";

export function SplitView({ docUrl }: { docUrl: AutomergeUrl }) {
  const [doc] = useDocument<{ text: string }>(docUrl, { suspense: true });
  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      <div style={{ flex: 1, borderRight: "1px solid #ccc", overflow: "auto" }}>
        <Editor docUrl={docUrl} />
      </div>
      <Preview content={doc?.text ?? ""} />
    </div>
  );
}