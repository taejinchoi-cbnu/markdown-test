import { useEffect, useState } from "react";
import { ROOM_NAME, awareness } from "../crdt";

interface UserState {
  name: string;
  color: string;
  clientID: number;
}

export function Header() {
  const [users, setUsers] = useState<UserState[]>([]);

  useEffect(() => {
    const observer = () => {
      const states = awareness.getStates();
      const list: UserState[] = [];
      states.forEach((state, clientID) => {
        const user = state.user as { name: string; color: string } | undefined;
        if (user) list.push({ ...user, clientID });
      });
      setUsers(list);
    };
    awareness.on("change", observer);
    observer();
    return () => {
      awareness.off("change", observer);
    };
  }, []);

  return (
    <header
      style={{
        height: "var(--header-height)",
        padding: "0 var(--space-4)",
        borderBottom: "1px solid var(--color-border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "var(--color-bg)",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          fontSize: "13px",
        }}
      >
        <DocumentIcon />
        <span style={{ color: "var(--color-text-tertiary)" }}>Workspace</span>
        <span style={{ color: "var(--color-text-tertiary)" }}>/</span>
        <span style={{ color: "var(--color-text)", fontWeight: 500 }}>
          {ROOM_NAME}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center" }}>
        {users.map((u, i) => (
          <Avatar key={u.clientID} user={u} index={i} />
        ))}
      </div>
    </header>
  );
}

function DocumentIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M3.5 1.5A1 1 0 0 1 4.5 0.5h5.586a1 1 0 0 1 0.707 0.293l3.121 3.121a1 1 0 0 1 0.293 0.707V14.5a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-13Z"
        stroke="var(--color-text-tertiary)"
        strokeWidth="1"
        fill="none"
      />
    </svg>
  );
}

function Avatar({ user, index }: { user: UserState; index: number }) {
  const initial = user.name.charAt(0).toUpperCase();
  return (
    <div
      title={user.name}
      style={{
        width: 26,
        height: 26,
        borderRadius: "var(--radius-full)",
        background: user.color,
        color: "#111",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        fontWeight: 600,
        marginLeft: index === 0 ? 0 : -8,
        border: "2px solid var(--color-bg)",
        boxSizing: "border-box",
      }}
    >
      {initial}
    </div>
  );
}
