import { useDocHandle } from "@automerge/react";
import { automergeSyncPlugin } from "@automerge/automerge-codemirror";
import { useEditor } from "../hooks/useEditor";
import type { AutomergeUrl } from "@automerge/automerge-repo";

export function Editor({ docUrl }: { docUrl: AutomergeUrl }) {
  const handle = useDocHandle<{ text: string }>(docUrl, { suspense: true });
  const { containerRef, viewRef } = useEditor(
    [automergeSyncPlugin({ handle, path: ["text"] })],
    handle.doc()?.text ?? "",
  );
  return (
    <div
      ref={containerRef}
      style={{ height: "100%", overflow: "auto" }}
      onClick={() => viewRef.current?.focus()}
    />
  );
}