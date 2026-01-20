import React from "react";
import ReactDOM from "react-dom/client";
import ChatApp from "./components/ChatApp";
import { ThemeProvider } from "./components/ThemeProvider";
import "animate.css";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ChatApp />
    </ThemeProvider>
  </React.StrictMode>,
);
