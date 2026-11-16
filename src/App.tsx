import { useEffect, useRef } from "react";
import "./game/style.css";

// Game dựng bằng Three.js thuần (src/game/*.js). React chỉ cung cấp phần tử gốc.
let started = false;

export default function App() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (started || !ref.current) return;
    started = true;
    // @ts-ignore — module JS thuần, không có khai báo kiểu
    import("./game/main.js").then((m) => m.initGame(ref.current));
  }, []);

  return <div id="game-root" ref={ref} />;
}
