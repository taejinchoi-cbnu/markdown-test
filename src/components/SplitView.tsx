import { Editor } from "./Editor";
import { Preview } from "./Preview";
import { useState } from "react";

export function SplitView() {
  const [content, setContent] = useState("");

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      <div style={{ flex: 1, borderRight: "1px solid #ccc", overflow: "auto" }}>
        <Editor onContentChange={setContent} />
      </div>
      <Preview content={content} />
    </div>
  );
}