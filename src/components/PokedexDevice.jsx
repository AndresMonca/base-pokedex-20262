import React from "react";
import { PokedexScreen } from "./PokedexScreen.jsx";
import { SideDrawers } from "./SideDrawers.jsx";
import { PhysicalShell } from "./PhysicalShell.jsx";

export function PokedexDevice() {
  return (
    <article className="pokedex" id="pokedex" aria-label="Closed Pokédex">
      <PokedexScreen />
      <SideDrawers />
      <PhysicalShell />
    </article>
  );
}
