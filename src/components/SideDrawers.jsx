import React from "react";

export function SideDrawers() {
  return (
    <>
          <aside className="side-drawer side-drawer-info" id="infoDrawer" aria-label="Essential Pokémon information" aria-hidden="true" inert="">
            <div className="drawer-inner" tabIndex="0">
              <div className="pokemon-data-summary">
                <header className="drawer-heading">
                  <span>Research file</span>
                  <strong>Essential info</strong>
                </header>
                <dl className="essentials-grid pokemon-description">
                  <div>
                    <dt>Species</dt>
                    <dd id="pokemonSpecies">&mdash;</dd>
                  </div>
                  <div>
                    <dt>Abilities</dt>
                    <dd id="pokemonAbilities">&mdash;</dd>
                  </div>
                </dl>
              </div>
              <dl className="essentials-grid pokemon-measurements">
                <div>
                  <dt>Generation</dt>
                  <dd id="pokemonGeneration">&mdash;</dd>
                </div>
                <div>
                  <dt>Weight</dt>
                  <dd id="pokemonWeight">&mdash;</dd>
                </div>
                <div>
                  <dt>Height</dt>
                  <dd id="pokemonHeight">&mdash;</dd>
                </div>
              </dl>
              <figure className="battle-sprite-card">
                <figcaption>
                  <span>BS</span>
                  <strong id="battleSpriteMode">Base</strong>
                </figcaption>
                <div className="battle-sprite-frame">
                  <img id="battleSprite" alt="" />
                </div>
              </figure>
            </div>
          </aside>
          <aside className="side-drawer side-drawer-stats" id="statsDrawer" aria-label="Pokémon stats and moves" aria-hidden="true" inert="">
            <div className="drawer-inner" tabIndex="0">
              <header className="drawer-heading">
                <span>Battle analysis</span>
                <strong>Stats &amp; moves</strong>
              </header>
              <div className="stats-list" id="statsList">
              </div>
              <div className="moves-block">
                <span>Learned moves</span>
                <div className="moves-list" id="movesList" tabIndex="0" role="region" aria-label="Learned moves">
                </div>
              </div>
            </div>
          </aside>
          <button className="side-trigger side-trigger-info" type="button" data-drawer="info" aria-controls="infoDrawer" aria-expanded="false">
            <span className="trigger-mark" aria-hidden="true">
              <i>
              </i>
              <i>
              </i>
            </span>
            <strong>Info</strong>
          </button>
          <button className="side-trigger side-trigger-stats" type="button" data-drawer="stats" aria-controls="statsDrawer" aria-expanded="false">
            <span className="trigger-mark" aria-hidden="true">
              <i>
              </i>
              <i>
              </i>
            </span>
            <strong>Stats</strong>
          </button>
    </>
  );
}
