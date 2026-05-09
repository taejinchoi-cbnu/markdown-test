import { render, screen, act } from "@testing-library/react";
import { describe, it, vi } from "vitest";

// Mock WebSocket
global.WebSocket = vi.fn().mockImplementation(() => ({
  send: vi.fn(),
  onopen: vi.fn(),
  onmessage: vi.fn(),
  onclose: vi.fn(),
  onerror: vi.fn(),
  readyState: 1, // OPEN
})) as unknown as { new (url: string): WebSocket };
import { SplitView } from "./SplitView";
import { yText } from "../crdt";
import "@testing-library/jest-dom";

// CodeMirror 에디터는 테스트 환경에서 렌더링하기 까다로우므로 에디터 부분은 Mocking 합니다.
vi.mock("./Editor", () => ({
  Editor: () => <div data-testid="mock-editor">Editor</div>,
}));

describe("SplitView Component BDD Test", () => {
  it("should update preview when yText changes", async () => {
    render(<SplitView />);

    // 초기 상태 확인
    expect(screen.getByTestId("mock-editor")).toBeInTheDocument();
    
    // yText 변경 시뮬레이션
    await act(async () => {
      yText.insert(0, "# Collaborative Title");
    });

    // 프리뷰에 반영되었는지 확인 (ReactMarkdown 내부 렌더링 확인)
    const previewHeading = await screen.findByRole("heading", { level: 1 });
    expect(previewHeading).toHaveTextContent("Collaborative Title");
  });
});
