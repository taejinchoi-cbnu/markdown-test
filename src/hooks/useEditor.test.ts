import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useEditor } from "./useEditor";

// Mock EditorView
vi.mock("@codemirror/view", async () => {
  const actual = await vi.importActual("@codemirror/view");
  return {
    ...actual,
    EditorView: vi.fn().mockImplementation(() => ({
      destroy: vi.fn(),
    })),
  };
});

describe("useEditor Hook Stability", () => {
  it("should not re-create editor instance when extensions reference changes", () => {
    const { result, rerender } = renderHook(
      ({ extensions }) => useEditor(extensions),
      {
        initialProps: { extensions: [] as any[] },
      }
    );

    const firstView = result.current.viewRef.current;
    
    // 새로운 배열 인스턴스로 리렌더링
    rerender({ extensions: [] });
    
    const secondView = result.current.viewRef.current;
    expect(firstView).toBe(secondView);
  });
});
