import { defaultKeymap, historyKeymap, history } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view"
import { marked } from "marked";
import { useEffect, useRef, useState } from "react"

function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [html, setHtml] = useState("")

  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const content = update.state.doc.toString();
        setHtml(marked(content) as string);
      }
    })

    const state = EditorState.create({
      doc: '',
      extensions: [
        history(), // redo/ondo 기능
        keymap.of([...defaultKeymap, ...historyKeymap]), // ctrl+c, enter, backspace 같은 기본 단축키 필요할 때
        markdown(), // 마크다운 파싱
        syntaxHighlighting(defaultHighlightStyle), // markdown 읽고 자동으로 css class 붙여줌
        EditorView.lineWrapping, // 긴 줄 자동 줄바꿈
        updateListener,
      ],
    })

    viewRef.current = new EditorView({
      state,
      parent: containerRef.current,
    })

    setHtml(marked('') as string);

    return () => {
      viewRef.current?.destroy()
    }
  }, [])

  return (
    <>
      <div style={{ display: "flex", height: "100vh" }}>
        <div ref={containerRef} style={{ flex: 1, overflow: "auto", borderRight: "1px solid #ccc", height: "100vh" }} onClick={() => viewRef.current?.focus()} />
        <div style={{ flex: 1, padding: "16px", overflow: "auto" }} dangerouslySetInnerHTML={{ __html: html }}/>
      </div>
    </>
    
  )
}

export default App
