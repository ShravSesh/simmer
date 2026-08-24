import React from "react";
import { createRoot } from "react-dom/client";
import Simmer from "./App.jsx";

createRoot(document.getElementById("root")).render(<Simmer />);

// The service worker precaches the JS bundle, and the auto-injected
// registration script installs a new worker but never reloads the page. With
// skipWaiting + clientsClaim the new worker takes control immediately, yet the
// tab that is already open keeps executing the OLD bundle until something
// reloads it — indefinitely, for a home-screen PWA that is never fully closed.
//
// That is not cosmetic. A device stuck on a pre-fix bundle reports every
// backend failure as "Household not found. Check the code.", because the old
// storage.js turned all errors into a false `keyExists`. Reload once when the
// controller changes so a deploy actually reaches devices.
if ("serviceWorker" in navigator) {
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return; // controllerchange can fire more than once
    reloading = true;
    window.location.reload();
  });
}
