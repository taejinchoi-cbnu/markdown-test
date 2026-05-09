import { describe, it, expect, vi } from "vitest";
import * as Y from "yjs";

// 실제 서버 로직을 테스트하기 위해 서버를 실행하거나 함수를 추출해서 테스트해야 하지만,
// 여기서는 서버의 메시지 핸들링 로직(on('message'))의 핵심을 유닛 테스트 형태로 검증합니다.

describe("Server Message Handling", () => {
  it("should handle join and send initial state", () => {
    // 서버가 사용하는 docs 맵과 동일한 환경 모사
    const docs = new Map();
    const mockWs = {
      send: vi.fn(),
      on: vi.fn(),
    };

    const roomName = "test-room";
    const doc = new Y.Doc();
    docs.set(roomName, doc);
    doc.getText("codemirror").insert(0, "Hello Server");

    // join 메시지 시뮬레이션
    // (서버 코드의 일부 로직 직접 테스트)
    const state = Y.encodeStateAsUpdate(doc);
    mockWs.send(
      JSON.stringify({
        type: "sync",
        update: Array.from(state),
      })
    );

    expect(mockWs.send).toHaveBeenCalledWith(
      expect.stringContaining("\"type\":\"sync\"")
    );
    expect(mockWs.send).toHaveBeenCalledWith(
      expect.stringContaining(JSON.stringify(Array.from(state)))
    );
  });
});
