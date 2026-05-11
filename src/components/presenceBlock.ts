import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import { type Extension, type Range } from "@codemirror/state";
import * as Y from "yjs";
import { awareness, doc, yText } from "../crdt";

interface UserField {
  name: string;
  color: string;
  colorLight: string;
}

interface CursorField {
  anchor?: unknown;
  head?: unknown;
}

class PresenceLinePlugin {
  decorations: DecorationSet = Decoration.none;
  private readonly view: EditorView;
  private readonly listener: (changes: {
    added: number[];
    updated: number[];
    removed: number[];
  }) => void;

  constructor(view: EditorView) {
    this.view = view;
    this.listener = ({ added, updated, removed }) => {
      const clients = [...added, ...updated, ...removed];
      if (clients.some((id) => id !== awareness.clientID)) {
        view.dispatch({});
      }
    };
    awareness.on("change", this.listener);
    this.decorations = this.computeDecorations();
  }

  update(_update: ViewUpdate) {
    this.decorations = this.computeDecorations();
  }

  private computeDecorations(): DecorationSet {
    const ranges: Range<Decoration>[] = [];
    const docState = this.view.state.doc;
    awareness.getStates().forEach((state, clientID) => {
      if (clientID === awareness.clientID) return;
      const cursor = state.cursor as CursorField | null | undefined;
      if (cursor == null || cursor.head == null) return;
      const user = state.user as UserField | undefined;
      if (user == null) return;
      const abs = Y.createAbsolutePositionFromRelativePosition(
        cursor.head as Y.RelativePosition,
        doc
      );
      if (abs == null || abs.type !== yText) return;
      if (abs.index < 0 || abs.index > docState.length) return;
      const line = docState.lineAt(abs.index);
      ranges.push(
        Decoration.line({
          attributes: {
            class: "cm-presenceLine",
            style: `background-color: ${user.colorLight};`,
          },
        }).range(line.from)
      );
    });
    return Decoration.set(ranges, true);
  }

  destroy() {
    awareness.off("change", this.listener);
  }
}

export const presenceBlock: Extension = ViewPlugin.fromClass(
  PresenceLinePlugin,
  {
    decorations: (v) => v.decorations,
  }
);
