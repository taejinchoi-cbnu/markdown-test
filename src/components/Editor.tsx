import { useMemo } from "react";
import { yCollab } from "y-codemirror.next";
import { useEditor } from "../hooks/useEditor";
import { yText, awareness } from "../crdt";

export function Editor() {
  const extensions = useMemo(() => [yCollab(yText, awareness)], []);
  const { containerRef, viewRef } = useEditor(extensions, "");
  return (
    <div
      ref={containerRef}
      style={{ height: "100%", overflow: "auto" }}
      onClick={() => viewRef.current?.focus()}
    />
  );
}
