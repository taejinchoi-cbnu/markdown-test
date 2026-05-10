import { useEffect, useState } from "react";
import { Editor } from "./Editor";
import { Preview } from "./Preview";
import { yText, awareness } from "../crdt";

interface UserState {
  name: string;
  color: string;
  clientID: number;
}

export function SplitView() {
  const [content, setContent] = useState(yText.toString());
  const [users, setUsers] = useState<UserState[]>([]);

  useEffect(() => {
    const observer = () => {
      setContent(yText.toString());
    };
    yText.observe(observer);

    const awarenessObserver = () => {
      const states = awareness.getStates();
      const userList: UserState[] = [];
      states.forEach((state, clientID) => {
        const user = state.user as { name: string; color: string } | undefined;
        if (user) {
          userList.push({ ...user, clientID });
        }
      });
      setUsers(userList);
    };
    awareness.on("change", awarenessObserver);
    awarenessObserver(); // Initial call

    return () => {
      yText.unobserve(observer);
      awareness.off("change", awarenessObserver);
    };
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "8px", background: "#333", display: "flex", gap: "8px" }}>
        {users.map((u) => (
          <span key={u.clientID} style={{ color: u.color, fontSize: "12px", border: `1px solid ${u.color}`, padding: "2px 6px", borderRadius: "4px" }}>
            ● {u.name}
          </span>
        ))}
      </div>
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{ flex: 1, borderRight: "1px solid #ccc", overflow: "auto" }}>
          <Editor />
        </div>
        <Preview content={content} />
      </div>
    </div>
  );
}
