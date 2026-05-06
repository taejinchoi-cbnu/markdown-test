import { SplitView } from "./components/SplitView";

function App() {

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <div style={{ flex: 1, overflow: "hidden" }}>
        <SplitView />
      </div>
    </div>
  );
}

export default App;