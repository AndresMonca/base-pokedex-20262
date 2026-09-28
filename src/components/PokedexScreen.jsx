import React from "react";

export function PokedexScreen() {
  return (
          <div className="screen-spine">
            <svg className="screen-clip-defs" width="0" height="0" aria-hidden="true" focusable="false">
              <defs>
                <clipPath id="screenShapeClip" clipPathUnits="objectBoundingBox">
                  <rect id="screenClipPanel" x="0" y=".085" width="1" height=".83" />
                  <ellipse id="screenClipTop" cx=".5" cy=".18" rx=".2" ry=".18" />
                  <ellipse id="screenClipBottom" cx=".5" cy=".82" rx=".2" ry=".18" />
                </clipPath>
              </defs>
            </svg>
            <span className="closed-core" aria-hidden="true"></span>
            <button className="power-button" id="powerButton" type="button" aria-label="Power on and open the Pokédex" title="Power on Pokédex">
              <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
                <path d="M16 4.5v12" />
                <path d="M9.1 8.6a10.5 10.5 0 1 0 13.8 0" />
              </svg>
            </button>
            <div className="screen-surface">
              <div className="screen-backdrop" id="screenBackdrop" aria-hidden="true"></div>
              <div className="home-wallpaper" aria-hidden="true">
                <div className="showcase-scene">
                  <canvas width="192" height="212"></canvas>
                  <img alt="" />
                  <span className="showcase-name"></span>
                </div>
                <div className="showcase-scene">
                  <canvas width="192" height="212"></canvas>
                  <img alt="" />
                  <span className="showcase-name"></span>
                </div>
              </div>
              <div className="screen-interface" id="screenInterface">
                <section className="screen-state home-state" id="homeState" hidden aria-label="Wikidex home">
                  <div className="home-content">
                    <img className="home-logo" src="assets/images/wikidex-logo.png" alt="Wikidex" />
                    <div className="search-zone">
                      <form className="search-form" id="searchForm" role="search">
                        <label className="sr-only" htmlFor="pokemonSearch">Search Pokémon by name or number</label>
                        <input id="pokemonSearch" type="search" role="combobox" spellCheck="false" autoCapitalize="none" maxLength="80" placeholder="Pokémon name or number" autoComplete="off" aria-autocomplete="list" aria-controls="suggestions" aria-expanded="false" />
                        <button type="submit" aria-label="Search Pokémon">
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <circle cx="10.7" cy="10.7" r="5.8"></circle>
                            <path d="m15.2 15.2 4.4 4.4"></path>
                          </svg>
                        </button>
                      </form>
                      <div className="home-suggestions">
                        <ul className="suggestions" id="suggestions" role="listbox" aria-label="Pokémon suggestions" hidden></ul>
                      </div>
                    </div>
                  </div>
                </section>
                <p className="sr-only" id="searchStatus" role="status" aria-atomic="true"></p>
                <section className="screen-state loading-state" id="loadingState" hidden role="status" aria-label="Loading Pokémon">
                  <div className="scanner-loader" aria-hidden="true"><span className="pokeball"></span></div>
                </section>
                <section className="screen-state error-state" id="errorState" hidden>
                  <span className="error-symbol" aria-hidden="true">!</span>
                  <strong id="errorTitle">Pokémon not found</strong>
                  <p id="errorMessage">Check the name or Pokédex number and try again.</p>
                </section>
                <section className="screen-state album-state" id="albumState" hidden aria-label="Album filters">
                  <button className="gym-back" id="gymBack" type="button" aria-label="Back to Pokémon Gym" title="Back to Pokémon Gym">
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
                      <path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <header className="album-filter-heading">
                    <span>Pokémon Album</span>
                    <strong id="albumFilterTitle">Explore your album</strong>
                    <small id="albumScreenFilter">All types</small>
                  </header>
                  <div className="album-filter-menu" id="albumFilterMenu"></div>
                  <div className="album-type-grid" id="albumTypeGrid" hidden></div>
                  <div className="album-filter-options" id="albumFilterOptions" hidden></div>
                  <div className="album-filter-footer" id="albumFilterFooter">
                    <span id="albumFilterHint">Combine filters to refine your album.</span>
                    <button id="albumResetFilters" type="button" disabled>Reset filters</button>
                  </div>
                </section>
                <section className="screen-state gym-state" id="gymState" hidden aria-label="Pokémon Gym">
                  <button className="power-off" id="commandBack" type="button" aria-label="Back" title="Back"><svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M24 16H8m7-7-7 7 7 7"/></svg></button>
                  <header className="gym-heading">
                    <span>Trainer hub</span>
                    <h2>Pokémon Gym</h2>
                  </header>
                  <div className="gym-options">
                    <button className="gym-option gym-option-album" id="gymAlbum" type="button">
                      <span className="gym-option-icon" aria-hidden="true">
                        <svg viewBox="0 0 32 32" fill="none" focusable="false">
                          <path d="M5.5 6.5c3.6-.8 7.1.1 10.5 2.6v17c-3.4-2.5-6.9-3.4-10.5-2.6v-17Z"/>
                          <path d="M26.5 6.5c-3.6-.8-7.1.1-10.5 2.6v17c3.4-2.5 6.9-3.4 10.5-2.6v-17Z"/>
                          <path d="M16 9.1v17"/>
                        </svg>
                      </span>
                      <span className="gym-option-copy"><strong>Pokémon Album</strong><small>Your captured collection</small></span>
                      <span className="gym-option-chevron" aria-hidden="true">›</span>
                    </button>
<button className="gym-option" type="button" disabled><span className="gym-option-icon" aria-hidden="true">♠</span><span className="gym-option-copy"><strong>Pokémon Casino</strong><small>Unavailable</small></span></button>
<button className="gym-option" type="button" disabled><span className="gym-option-icon" aria-hidden="true">?</span><span className="gym-option-copy"><strong>???</strong><small>Coming soon</small></span></button>
                    
                    
                  </div>
                </section>
                <div className="content-curtain" id="contentCurtain" aria-hidden="true">
                  <span>
                  </span>
                </div>
              </div>
              <section className="screen-state pokemon-state" id="pokemonState" hidden>
                <div className="identity-zone">
                  <header className="pokemon-heading">
                    <div className="pokemon-identity">
                      <h1 id="pokemonName">
                      </h1>
                      <span className="pokemon-id" id="pokemonId">
                      </span>
                    </div>
                    <div className="type-list" id="typeList">
                    </div>
                  </header>
                  <div className="artwork-stage">
                    <span className="artwork-halo" aria-hidden="true">
                    </span>
                    <img id="pokemonArt" alt="" />
                    <span className="capture-ball capture-pokeball" id="captureBall" aria-hidden="true" hidden></span>
                  </div>
                </div>
                <button className="shiny-toggle" id="shinyToggle" type="button" disabled aria-label="Show shiny version" aria-pressed="false" title="Show shiny version">
                  <span aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M12 1C10 8 8 10 1 12c7 2 9 4 11 11 2-7 4-9 11-11-7-2-9-4-11-11Z"/></svg></span>
                </button>
                <button className="capture-toggle" id="captureToggle" type="button" disabled aria-label="Capture Pokémon" aria-pressed="false">
                  <span className="capture-pokeball" aria-hidden="true"></span>
                  <svg className="capture-release-arrow" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 12 12 4M5 4h7v7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                <span className="sr-only" id="captureStatus" role="status" aria-live="polite"></span>
              </section>
            </div>
            <button className="album-toggle" id="albumToggle" type="button" aria-label="Open Pokémon Gym" aria-pressed="false" title="Open Pokémon Gym">
              <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
                <path d="M11 6.5a1.5 1.5 0 0 1 2.3-1.3l14 9.5a1.6 1.6 0 0 1 0 2.6l-14 9.5a1.5 1.5 0 0 1-2.3-1.3v-19Z"/>
              </svg>
            </button>
            <button className="search-toggle" id="searchToggle" type="button" aria-label="Search another Pokémon" title="Search another Pokémon">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
                <circle cx="10.5" cy="10.5" r="5.9"></circle>
                <path d="m15 15 4.6 4.6"></path>
              </svg>
            </button>
            <span className="screen-edge screen-edge-left" aria-hidden="true">
            </span>
            <span className="screen-edge screen-edge-right" aria-hidden="true">
            </span>
          </div>
  );
}
