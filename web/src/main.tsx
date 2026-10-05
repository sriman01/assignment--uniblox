import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { router } from "./router";
import "./app.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("root element is missing");
}

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
