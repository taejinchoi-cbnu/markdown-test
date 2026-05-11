import { Header } from "./components/Header";
import { SplitView } from "./components/SplitView";

export default function App() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <Header />
      <div style={{ flex: 1, overflow: "hidden" }}>
        <SplitView />
      </div>
    </div>
  );
}
