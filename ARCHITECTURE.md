# ARCHITECTURE

실시간 협업 마크다운 에디터 프로토타입의 시스템 구조와 작업 이력 정리.
모든 코드 인용은 `path:line` 형식으로 코드를 직접 따라 읽을 수 있게 작성됨.

---

## 1. 시스템 개요

브라우저 클라이언트 두 개 이상이 단일 WebSocket 서버를 매개로 동일한 마크다운 문서를 동시 편집한다. 동기화 단위는 **Yjs CRDT (`Y.Doc` + `Y.Text`)**, 시각적 동시성(커서·선택·점유 라인)은 **Yjs Awareness**가 담당한다. 에디터는 CodeMirror 6, 마크다운 렌더링은 react-markdown.

```
┌─────────────────────────────┐                  ┌─────────────────────────────┐
│ Browser Client A            │                  │ Browser Client B            │
│                             │                  │                             │
│  CodeMirror 6 (Editor)      │                  │  CodeMirror 6 (Editor)      │
│         │                   │                  │         │                   │
│  yCollab (y-codemirror.next)│                  │  yCollab (y-codemirror.next)│
│         │                   │                  │         │                   │
│  Y.Doc + Y.Text  ◄──awareness──►  Y.Doc + Y.Text          │
│         │                   │       ▲          │         │                   │
│         │ doc.on("update")  │       │ ws       │         │                   │
│         ▼                   │       │          │         ▼                   │
│  WebSocket(ws://:1234)──────┼───────┘          │  WebSocket(ws://:1234)──────┐
│                             │                  │                             │ │
│  react-markdown (Preview)   │                  │  react-markdown (Preview)   │ │
└─────────────────────────────┘                  └─────────────────────────────┘ │
                       ▲                                                          │
                       │                                                          │
            ┌──────────┴──────────────────────────────────────────────────────────┘
            │
            ▼
┌────────────────────────────────────────┐
│ Yjs WebSocket Server (server/index.mjs)│
│   docs:           Map<room, Y.Doc>     │
│   awarenessStates: Map<room, Awareness>│
│   broadcasts updates between clients   │
└────────────────────────────────────────┘
```

핵심 특성:

- **룸 단위 분리**: 서버는 `room` 이름별로 별도 `Y.Doc` + `Awareness` 인스턴스 관리. 현재는 단일 룸 하드코딩 (`ROOM_NAME = "room1"`, `src/crdt.ts:8`)
- **CRDT 수렴 보장**: Yjs가 어느 순서로 변경이 도착하든 모든 클라이언트가 동일한 문서 상태로 수렴하도록 처리. 충돌 해결 로직을 우리가 작성할 필요 없음
- **Presence는 별도 채널**: Awareness는 ephemeral (30초 만료). 커서·이름·색상·선택 영역 등이 실린다

---

## 2. 기술 스택 (코드 매핑)

| 영역                    | 라이브러리/도구                    | 진입점                                                    |
| ----------------------- | ---------------------------------- | --------------------------------------------------------- |
| 에디터                  | CodeMirror 6 (`@codemirror/*`)     | `src/hooks/useEditor.ts:11-34`                            |
| CRDT 코어               | Yjs (`yjs`)                        | `src/crdt.ts:10-12`                                       |
| Yjs ↔ CodeMirror 바인딩 | `y-codemirror.next` (`yCollab`)    | `src/components/Editor.tsx:2,5,8-11`                      |
| Presence 프로토콜       | `y-protocols/awareness`            | `src/crdt.ts:3-6,12`, `src/components/presenceBlock.ts:9` |
| 마크다운 렌더           | react-markdown + remark/rehype     | `src/components/Preview.tsx:1-21`                         |
| 서버                    | `ws` + `y-protocols/awareness`     | `server/index.mjs:1-8`                                    |
| 동기화 프로토콜         | 자체 JSON 4종 (간이 y-websocket)   | `server/index.mjs:61-107`, `src/crdt.ts:32-101`           |
| UI                      | React 19, 인라인 스타일 + CSS 변수 | `src/components/*.tsx`, `src/index.css`                   |

---

## 3. 데이터 플로우 — 키 입력에서 다른 화면까지

사용자 A가 키 한 번을 누르면 다음 8단계로 사용자 B의 화면이 갱신된다.

1. **A의 CodeMirror가 input transaction dispatch**
   브라우저 키 이벤트 → CodeMirror가 자체 트랜잭션 생성 (`isUserEvent("input")`).

2. **yCollab의 ySync 플러그인이 트랜잭션을 yText에 반영**
   `node_modules/y-codemirror.next/src/y-sync.js:133-153`의 `update()`. CodeMirror의 `iterChanges`로 변경 범위를 읽어 `ytext.delete()` / `ytext.insert()` 호출. 모든 호출은 `ytext.doc.transact(...)`로 묶여 단일 update 이벤트로 발화.

3. **Y.Doc "update" 이벤트 발화**
   yText 변경이 doc 레벨로 propagate.

4. **A 클라가 변경 바이너리를 WS로 전송**
   `src/crdt.ts:65-76`의 `doc.on("update", ...)`. `update`(`Uint8Array`)를 `Array.from(...)`으로 일반 배열에 담아 JSON 메시지로 송신:

   ```js
   ws.send(JSON.stringify({ type: "update", update: Array.from(update) }));
   ```

   `origin === "server"` 가드로 서버에서 받은 echo는 다시 송신하지 않는다.

5. **서버가 받아서 자기 Y.Doc에 적용 + 다른 클라로 broadcast**
   `server/index.mjs:89-95`. `Y.applyUpdate(doc, update)`로 서버 측 사본 갱신, 같은 룸의 다른 ws에게 동일 메시지 broadcast.

6. **B 클라가 메시지 수신 → 자기 Y.Doc에 적용**
   `src/crdt.ts:44-62`의 `ws.onmessage`. `Y.applyUpdate(doc, update, "server")` — 세 번째 인자 `origin="server"`가 4단계의 echo 가드와 짝을 이루어 무한 루프 방지.

7. **B의 yText.observe 옵저버가 setContent 호출**
   `src/components/SplitView.tsx:14-21`. yText 변경 → `setContent(yText.toString())`로 React 상태 갱신.

8. **B의 react-markdown이 새 마크다운을 HTML로 산출**
   `src/components/Preview.tsx:14-21`의 `<ReactMarkdown>`이 새 content를 받아 remark/rehype 파이프라인으로 처리 → 미리보기 패널 갱신.

에디터 자체의 갱신은 별도 경로다. yCollab의 ySync 플러그인이 `yText.observe`로 들어오는 update를 듣고, 본인이 origin이 아닐 때 CodeMirror에 `view.dispatch({ changes, annotations: [ySyncAnnotation.of(this.conf)] })`로 변경을 적용한다 (`y-sync.js:107-128`). `ySyncAnnotation`은 "이건 원격에서 온 것"이라는 표식.

---

## 4. Yjs CRDT 메커니즘

### Y.Doc / Y.Text

```ts
// src/crdt.ts:10-12
export const doc = new Y.Doc();
export const yText = doc.getText("codemirror");
export const awareness = new Awareness(doc);
```

- `Y.Doc`: 공유 문서의 루트. 여러 자료형(`Y.Text`, `Y.Map`, `Y.Array`)을 담을 수 있음.
- `Y.Text`: 문자열 CRDT. 동시 삽입·삭제도 deterministic하게 수렴.
- 모든 변경은 `update`(바이너리)로 직렬화 가능 → 네트워크 전송 / 디스크 저장.

### update 적용과 origin 가드

```ts
Y.applyUpdate(doc, update, origin?)
```

세 번째 인자 `origin`은 어디서 온 update인지 표식. `doc.on("update", (update, origin) => ...)`에서 다시 같은 origin으로 송신하지 않도록 가드를 짤 때 쓴다.

이 프로젝트의 패턴 (`src/crdt.ts:49-52, 65-76`):

- 서버에서 받은 update는 `Y.applyUpdate(doc, update, "server")`로 적용
- 로컬 update 핸들러는 `if (origin === "server") return`으로 echo 차단

### Y.RelativePosition

인덱스 기반 좌표("5번째 글자")는 다른 사용자가 위에 글자를 삽입하는 순간 깨진다. `Y.RelativePosition`은 인덱스가 아니라 **콘텐츠에 닻을 내리는** 추상 좌표다. 그 글자가 어디로 이동하든 RP는 따라간다.

만들기:

```ts
const rp = Y.createRelativePositionFromTypeIndex(yText, index, assoc);
```

`assoc` 파라미터로 "왼쪽 글자에 들러붙을지 / 오른쪽에 들러붙을지" 결정 — 경계 충돌 시 새 글자가 어느 쪽으로 빠지는지가 달라진다.

해석:

```ts
const abs = Y.createAbsolutePositionFromRelativePosition(rp, doc);
// abs.index = 현재 시점의 절대 인덱스 (이 시점 기준)
```

이 프로젝트에서 RP는 두 군데에서 활용:

- yCollab이 자동으로 커서 위치를 RP로 broadcast (`node_modules/y-codemirror.next/src/y-remote-selections.js:167-173`)
- 우리의 presence-line 플러그인이 그 RP를 줄 단위로 시각화 (`src/components/presenceBlock.ts:57-63`)

### Awareness가 doc과 분리된 이유

`Y.Doc`은 영구 수렴 데이터. 모든 변경 이력이 CRDT에 보존된다. 반면 "지금 어디에 커서가 있는지"는 ephemeral — 사용자가 떠나면 사라져야 하고, history에 쌓일 필요도 없다. 그래서 Yjs는 **awareness**라는 별도 채널을 둔다.

```ts
// src/crdt.ts:26-30 — 사용자 정보 publish
awareness.setLocalStateField("user", {
  name: random(NAMES),
  color: userColor.main,
  colorLight: userColor.light,
});
```

awareness 상태는 30초 무업데이트 시 자동 만료된다. 사용자가 브라우저 닫으면 자동 정리.

---

## 5. WebSocket 프로토콜

자체 정의한 4종 JSON 메시지. 표준 `y-websocket`은 binary지만, 디버깅 편의를 위해 JSON 텍스트로 단순화.

| 타입        | 방향                        | 페이로드                     | 코드 위치                                                                                  |
| ----------- | --------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------ |
| `join`      | 클라 → 서버                 | `{ type, doc: roomName }`    | 클라 송신: `src/crdt.ts:34-41`                                                             |
| `sync`      | 서버 → 클라 (join 직후 1회) | `{ type, update: number[] }` | 서버 송신: `server/index.mjs:71-77`                                                        |
| `update`    | 양방향                      | `{ type, update: number[] }` | 서버: `index.mjs:89-95` / 클라 송신: `crdt.ts:65-76` / 클라 수신: `crdt.ts:49-52`          |
| `awareness` | 양방향                      | `{ type, update: number[] }` | 서버: `index.mjs:96-102, 21-42` / 클라 송신: `crdt.ts:79-101` / 클라 수신: `crdt.ts:54-57` |

### 서버의 stateful 구조

```js
// server/index.mjs:10-13
const docs = new Map(); // room -> Y.Doc
const awarenessStates = new Map(); // room -> Awareness
const wsToClientIds = new Map(); // ws -> Set<clientID>
const connections = new Map(); // ws -> room
```

- 룸은 lazy 생성 (`getDocAndAwareness`, `index.mjs:15-48`)
- 룸 생성 시 `awareness.on("update", ...)` 리스너 등록 → 어느 클라가 awareness를 쏘면 서버가 자동으로 같은 룸의 다른 모두에게 broadcast (`index.mjs:21-42`)
- 클라 연결 종료 시 그 ws의 모든 client awareness 제거 (`index.mjs:109-124`) — 30초 타임아웃을 기다리지 않고 즉시 정리

### join 시 초기 sync

서버는 클라가 join하는 순간:

1. 현재 Y.Doc 전체 상태를 `Y.encodeStateAsUpdate(doc)`로 인코딩해 `sync` 메시지로 1회 전송 (`index.mjs:71-77`)
2. 현재 awareness 모든 상태를 `encodeAwarenessUpdate(...)`로 인코딩해 `awareness` 메시지로 1회 전송 (`index.mjs:80-86`)

이로써 새 클라는 즉시 "현재 시점 스냅샷"을 받고, 이후 증분 업데이트만 따라 받는다.

---

## 6. CodeMirror 통합 — useEditor + yCollab

### useEditor 훅

```ts
// src/hooks/useEditor.ts:11-31
export function useEditor(extensions: Extension[] = [], initialDoc = "") {
  // ...
  const state = EditorState.create({
    doc: initialDoc,
    extensions: [
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      markdown(),
      syntaxHighlighting(defaultHighlightStyle),
      EditorView.lineWrapping,
      ...extensions, // <-- 호출자가 협업 관련 extension을 여기로 주입
    ],
  });
  // ...
}
```

### Editor 컴포넌트의 extension 주입

```tsx
// src/components/Editor.tsx:5-11
import { presenceBlock } from "./presenceBlock";

export function Editor() {
  const extensions = useMemo(
    () => [yCollab(yText, awareness), presenceBlock],
    []
  );
  // ...
}
```

배열 순서가 곧 update 처리 순서다. **yCollab이 먼저** 와야 yText 동기화가 끝난 다음 우리 플러그인이 동기화된 상태를 본다.

### yCollab 내부 (참고)

`yCollab(yText, awareness)`는 세 가지를 묶어 반환:

- **ySync** ViewPlugin (`y-sync.js:161`) — yText ↔ CodeMirror doc 동기화
- **yRemoteSelections** ViewPlugin (`y-remote-selections.js:255`) — 원격 커서/선택 시각화 + 로컬 커서 publish
- **yUndoManagerKeymap** — undo/redo 통합

`ySyncAnnotation` (`y-sync.js:95`)이 트랜잭션 출처를 구분한다. 원격 sync에서 온 transaction에 이 annotation이 붙어 있어, 다른 플러그인이 "이건 원격이다"를 식별할 수 있다.

---

## 7. Awareness — 협업 presence

### yCollab이 자동 publish하는 필드

- `user: { name, color, colorLight }` — 단, 이 프로젝트에서는 우리가 직접 채움 (`src/crdt.ts:26-30`). yCollab은 이 필드가 있으면 그대로 활용.
- `cursor: { anchor: RelativePosition, head: RelativePosition }` — yCollab의 `yRemoteSelections.update()`가 매 view 업데이트마다 자동 publish (`y-remote-selections.js:160-178`).

### 우리가 추가한 필드

**없음** (V0.1에서 모두 제거됨). 이전 V0는 자체 `editingRange` 필드를 추가했다가 폐기 — 11절 작업 이력 참고.

### 우리 코드는 awareness를 read-only로 소비

```ts
// src/components/presenceBlock.ts:48-74 (computeDecorations)
awareness.getStates().forEach((state, clientID) => {
  if (clientID === awareness.clientID) return;          // 자기 자신 스킵
  const cursor = state.cursor as CursorField | ...;     // yCollab이 채운 필드
  if (cursor == null || cursor.head == null) return;
  const user = state.user as UserField | undefined;
  if (user == null) return;
  const abs = Y.createAbsolutePositionFromRelativePosition(
    cursor.head as Y.RelativePosition, doc
  );
  if (abs == null || abs.type !== yText) return;
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
```

awareness 변경 이벤트 구독 패턴은 yCollab의 `yRemoteSelections`와 동일:

```ts
// src/components/presenceBlock.ts:35-41
this.listener = ({ added, updated, removed }) => {
  const clients = [...added, ...updated, ...removed];
  if (clients.some((id) => id !== awareness.clientID)) {
    view.dispatch({}); // 원격 변경에만 dispatch (재진입 방지)
  }
};
awareness.on("change", this.listener);
```

비-로컬 클라이언트가 변경된 경우에만 dispatch — 로컬 awareness 변경에 대해 dispatch하면 update() 사이클 안에서 중첩 dispatch가 일어나 CodeMirror가 깨진다 (V0에서 직접 부딪힌 함정).

### Header도 awareness 직접 구독

```tsx
// src/components/Header.tsx:13-28
useEffect(() => {
  const observer = () => {
    const states = awareness.getStates();
    // ...users 추출...
    setUsers(list);
  };
  awareness.on("change", observer);
  observer();
  return () => awareness.off("change", observer);
}, []);
```

여기는 React 컴포넌트 안이라 setState로 충분 — CodeMirror dispatch 대신 React 리렌더로 화면 갱신.

---

## 8. 마크다운 렌더링 파이프라인

### 데이터 흐름

```
yText (Yjs)
   │ yText.observe
   ▼
SplitView.content (React state, src/components/SplitView.tsx:13,14-21)
   │ props
   ▼
<Preview content={content} />
   │
   ▼
ReactMarkdown (remark/rehype 체인 적용)
```

### Preview의 플러그인 체인

```tsx
// src/components/Preview.tsx:14-21
<div
  className="preview-pane"
  style={{ flex: 1, padding: "16px", overflow: "auto" }}
>
  <ReactMarkdown
    remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
    rehypePlugins={[rehypeKatex, rehypeHighlight]}
  >
    {content}
  </ReactMarkdown>
</div>
```

- `remark-gfm`: 표, 체크박스, 취소선, 자동 링크
- `remark-math`: `$수식$` / `$$수식$$` 파싱
- `remark-breaks`: 한 줄 개행을 `<br>`로
- `rehype-katex`: 위 수식을 KaTeX로 렌더링 (`katex/dist/katex.min.css` import 필요, `Preview.tsx:7`)
- `rehype-highlight`: 코드 블록 syntax highlighting

### 스타일

`.preview-pane` 규칙은 `src/index.css:54-150` (대략)에 정의. 디자인 토큰 기반:

- `max-width: 720px` — Notion 스타일 readable width
- 헤딩 위계 (h1 큰 폰트 + bottom border, h2/h3 점진 축소)
- 코드 블록은 `var(--color-bg-subtle)` 배경
- 인용은 `var(--color-primary)` 좌측 바 + faint 배경

---

## 9. UI 디자인 시스템

### 디자인 토큰

`:root`에 모두 정의 (`src/index.css:1-40`):

- 배경: `--color-bg`, `--color-bg-elevated`, `--color-bg-subtle`
- 경계: `--color-border`, `--color-border-strong`
- 텍스트: `--color-text`, `--color-text-secondary`, `--color-text-tertiary`
- 브랜드: `--color-primary` (`#2dcb9a`), `--color-primary-faint`
- 간격: `--space-1` ~ `--space-6`
- 라운드: `--radius-sm/md/lg/full`
- 헤더: `--header-height: 44px`

컴포넌트는 인라인 스타일에서 `var(--token)`으로 참조. 모든 색상/간격이 한 곳에 모여 있어 테마 변경이 토큰 한 줄 수정으로 끝난다.

### Header

`src/components/Header.tsx`. 좌측은 `Workspace / room1` 형식의 breadcrumb (`ROOM_NAME` 재참조, `src/crdt.ts:8`), 우측은 협업자 아바타. 아바타 색은 awareness `user.color`에서 직접 가져옴.

### SplitView

`src/components/SplitView.tsx`. flex row로 좌측 Editor, 우측 Preview. divider는 `var(--color-border)`로 부드럽게.

### 색상 일관성

한 사용자의 `awareness.user.color` / `colorLight` 한 쌍이 다음 세 곳에 일관되게 사용된다:

1. yCollab의 원격 커서 caret 색
2. presenceBlock의 줄 배경 색
3. Header의 협업자 아바타 배경 색

이 일관성이 "이 색은 저 사람"이라는 시각적 매핑을 자연스럽게 만든다.

---

## 10. 커서/Selection 시각화 — 3중 레이어

같은 사용자의 활동을 세 가지 레이어가 중첩해서 보여준다:

| 레이어                       | 출처                          | CSS 클래스                                | 표시 조건                       |
| ---------------------------- | ----------------------------- | ----------------------------------------- | ------------------------------- |
| 원격 커서 caret + 이름표     | yCollab `yRemoteSelections`   | `cm-ySelectionCaret`, `cm-ySelectionInfo` | `state.cursor` 존재             |
| 원격 드래그 선택             | yCollab `yRemoteSelections`   | `cm-ySelection`, `cm-yLineSelection`      | `cursor.anchor !== cursor.head` |
| 원격 사용자 라인 (V0.1 신규) | `presenceBlock` (이 프로젝트) | `cm-presenceLine`                         | `state.cursor.head` 존재        |

세 레이어 모두 같은 `user.colorLight` 출처를 쓰므로 시각적으로 자연스럽게 합쳐진다.

CSS 정의:

- `.cm-ySelectionInfo`, `.cm-ySelectionCaret`: `src/index.css:42-53`
- `.cm-presenceLine`: 별도 규칙 없음 — Decoration의 inline `style="background-color: ..."`만으로 충분

---

## 11. 작업 이력

### R1: UI 리디자인

- Header 컴포넌트 신규 (`src/components/Header.tsx`)
- 디자인 토큰 도입 + preview 타이포그래피 (`src/index.css`)
- SplitView 슬림화: 기존 user-chip bar 제거 → Header로 이동, divider 부드럽게
- App에 Header 슬롯
- `crdt.ts`에 `ROOM_NAME` 상수 추출

### R2: V0 (range-based) 폐기

시도했던 설계:

- 자체 awareness 필드 `editingRange: { startRP, endRP }` 추가
- 키 입력마다 startRP 유지 / endRP 갱신
- 다른 사용자의 editingRange를 `Decoration.mark`로 띠 형태 시각화

폐기 이유:

- **재진입 버그**: 처음에 awareness 리스너가 로컬 변경에도 dispatch를 발사 → CodeMirror update 사이클 안에서 중첩 dispatch → yCollab의 yRemoteSelections까지 깨짐. 비-로컬 가드 추가로 해결했지만…
- **트래픽 두 배**: yCollab의 cursor + 우리 editingRange가 매 키 입력마다 broadcast. awareness 처리 부하가 두 배가 되어 시각화가 들쭉날쭉
- **복잡도**: 두 RP 인코딩/디코딩, 두 위치를 한 번에 갱신, blur 핸들러, idle 정리 등 — 표면적 큼

### R3: V0.1 (line-based)

방향 전환: 자체 publish 없이 yCollab이 이미 broadcast하는 `cursor.head`를 read-only로 소비.

```ts
// src/components/presenceBlock.ts:57-71
const abs = Y.createAbsolutePositionFromRelativePosition(cursor.head, doc);
const line = docState.lineAt(abs.index);
ranges.push(
  Decoration.line({
    attributes: {
      class: "cm-presenceLine",
      style: `background-color: ${user.colorLight};`,
    },
  }).range(line.from)
);
```

장점:

- **추가 트래픽 0** — 안정성
- **재진입 불가** — write 자체가 없으므로
- **푸시다운 자동** — `cursor.head`가 RP라서 콘텐츠가 어떻게 변하든 항상 올바른 위치
- **코드 절반** — V0의 ~130줄에서 ~85줄로

---

## 12. 알려진 한계 / V1 후보

- **잠금 강제 없음**: V0.1은 시각화만. 두 사용자가 같은 라인에 동시 입력 가능. 강제 잠금은 `EditorState.changeFilter`로 특정 범위 차단 (V1 작업)
- **awareness race condition**: 네트워크 지연 동안 두 클라가 거의 동시에 같은 영역 입력 시작 가능. CRDT가 수렴은 보장하지만 잠금은 보장 못함 — "근사적 협조 잠금"이 한계
- **단일 룸 하드코딩**: `ROOM_NAME = "room1"` (`src/crdt.ts:8`). 라우팅 도입 시 URL 또는 room picker 필요
- **서버 in-memory**: 재시작 시 모든 doc 손실. `Y.encodeStateAsUpdate`/`applyUpdate`로 디스크 영속 가능하지만 미구현
- **JSON 메시지**: 표준 `y-websocket`처럼 binary로 가면 메시지 크기가 줄어듦. 프로토타입이라 후순위
- **마크다운 블록(단락) 인식 미사용**: V0.1은 "현재 커서 라인" 단위. 단락 단위로 묶어 시각화하는 V2 가능 (`@codemirror/lang-markdown`의 syntax tree 활용)
- **복구 흐름 없음**: 클라가 잠시 끊겼다 재연결되면 join → 전체 sync로 복구되지만, 재연결 자체는 클라에 미구현 (`crdt.ts:32`는 단발성 `new WebSocket(...)`)
