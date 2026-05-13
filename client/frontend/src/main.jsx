import React from "react";

import ReactDOM from "react-dom/client";

import App from "./App";

import "./styles/cybernet.css";

import ExamProvider from "./context/ExamContext";

ReactDOM.createRoot(
  document.getElementById("root")
).render(

  <React.StrictMode>

    <ExamProvider>

      <App />

    </ExamProvider>

  </React.StrictMode>

);