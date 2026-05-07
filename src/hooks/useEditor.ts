import { defaultKeymap, historyKeymap, history } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { oneDark } from "@codemirror/theme-one-dark";
import { useEffect, useRef } from "react";

export function useEditor(extensions: Extension[] = [], initialDoc = "") {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const state = EditorState.create({
      doc: initialDoc,
      extensions: [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        markdown(),
        syntaxHighlighting(defaultHighlightStyle),
        oneDark,
        EditorView.lineWrapping,
        ...extensions,
      ],
    });
    viewRef.current = new EditorView({ state, parent: containerRef.current });
    return () => viewRef.current?.destroy();
  }, []);

  return { containerRef, viewRef };
}