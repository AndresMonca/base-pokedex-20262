import React from "react";
import { DeviceStage } from "./components/DeviceStage.jsx";
import { ProgressDialog } from "./components/ProgressDialog.jsx";
import { usePokedexRuntime } from "./hooks/usePokedexRuntime.js";

export default function App() {
  usePokedexRuntime();
  return (
    <>
      <main className="app-layout">
        <DeviceStage />
      </main>
      <ProgressDialog />
    </>
  );
}
