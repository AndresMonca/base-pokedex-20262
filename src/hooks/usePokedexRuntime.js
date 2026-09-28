import { useEffect } from "react";
import { initPokedexRuntime } from "../runtime/pokedexRuntime.js";

export function usePokedexRuntime() {
  useEffect(() => initPokedexRuntime(), []);
}
