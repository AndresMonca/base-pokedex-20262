import React from "react";
import { PokedexDevice } from "./PokedexDevice.jsx";
import { AlbumPanel } from "./AlbumPanel.jsx";

export function DeviceStage() {
  return (
    <section className="device-stage" aria-label="Wikidex Pokédex">
      <PokedexDevice />
      <AlbumPanel />
    </section>
  );
}
