import { useEffect } from "react";
import { useEditor } from "../hooks/useEditor";

interface EditorProps {
  onContentChange: (content: string) => void;
}

export function Editor({ onContentChange }: EditorProps) {
  const { containerRef, viewRef, content } = useEditor();

  useEffect(() => {
    onContentChange(content);
  }, [content, onContentChange]);

  return (
    <div
      ref={containerRef}
      style={{ height: "100%", overflow: "auto" }}
      onClick={() => viewRef.current?.focus()}
    />
  );
}