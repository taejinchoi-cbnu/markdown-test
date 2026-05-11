import { useMemo } from "react";
import { yCollab } from "y-codemirror.next";
import { useEditor } from "../hooks/useEditor";
import { yText, awareness } from "../crdt";
import { presenceBlock } from "./presenceBlock";

export function Editor() {
  const extensions = useMemo(
    () => [yCollab(yText, awareness), presenceBlock],
    []
  );
  const { containerRef, viewRef } = useEditor(extensions, "");
  return (
    <div
      ref={containerRef}
      style={{ height: "100%", overflow: "auto" }}
      onClick={() => viewRef.current?.focus()}
    />
  );
}
