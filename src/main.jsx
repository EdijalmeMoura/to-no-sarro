import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { initSentry } from "./utils/sentry.js";

initSentry();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
