import { describe, it, beforeEach, vi, expect } from "vitest";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";

// Mock WebSocket
global.WebSocket = vi.fn().mockImplementation(() => ({
  send: vi.fn(),
  onopen: vi.fn(),
  onmessage: vi.fn(),
  onclose: vi.fn(),
  onerror: vi.fn(),
  readyState: 1, // OPEN
})) as unknown as { new (url: string): WebSocket };

describe("Yjs CRDT & Awareness Logic", () => {
  let doc: Y.Doc;
  let awareness: Awareness;

  beforeEach(() => {
    doc = new Y.Doc();
    awareness = new Awareness(doc);
  });

  it("should initialize awareness with local client id", () => {
    expect(awareness.clientID).toBeTypeOf("number");
  });

  it("should allow setting local state with user info", () => {
    const userInfo = { name: "Test User", color: "#ff0000" };
    awareness.setLocalStateField("user", userInfo);
    
    expect(awareness.getLocalState()?.user).toEqual(userInfo);
  });
});
