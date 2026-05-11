import { useEffect, useState } from "react";
import { Editor } from "./Editor";
import { Preview } from "./Preview";
import { yText } from "../crdt";

export function SplitView() {
  const [content, setContent] = useState(yText.toString());

  useEffect(() => {
    const observer = () => {
      setContent(yText.toString());
    };
    yText.observe(observer);
    return () => {
      yText.unobserve(observer);
    };
  }, []);

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden", height: "100%" }}>
      <div style={{ flex: 1, borderRight: "1px solid var(--color-border)", overflow: "auto" }}>
        <Editor />
      </div>
      <Preview content={content} />
    </div>
  );
}
