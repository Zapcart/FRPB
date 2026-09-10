import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { installFrpbFallback } from "./lib/webFallback";
import "./globals.css";

// In a plain browser (Vite dev at :5173) the Electron preload bridge is
// missing. Install a graceful mock so the UI renders instead of crashing
// with an undefined `window.frpb` reference.
installFrpbFallback();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
