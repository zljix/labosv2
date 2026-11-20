import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./app/style.css";
import "./app/workspace.css";
createRoot(document.getElementById("root")!).render(<App />);
