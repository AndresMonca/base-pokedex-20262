import React from "react";

export function AlbumPanel() {
  return (
        <aside className="album-panel" id="albumPanel" hidden aria-hidden="true" aria-label="Captured Pokémon">
          <span className="album-fold-pokeball" aria-hidden="true"></span>
          <header className="album-panel-heading">
            <div className="album-search-actions">
            <label className="album-search">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><circle cx="10.7" cy="10.7" r="5.8"/><path d="m15.2 15.2 4.4 4.4"/></svg>
              <input id="albumSearch" type="search" autoComplete="off" spellCheck="false" placeholder="Search Pokémon..." aria-label="Search Pokémon in the album" />
            </label>
            <button className="album-view-toggle" id="albumViewToggle" type="button" aria-label="Show My Pokémon" title="Show My Pokémon">All Pokémon</button>
            <button className="album-mobile-filter-toggle" id="albumMobileFilterToggle" type="button" aria-label="Album filters" title="Album filters" aria-expanded="false" aria-controls="albumMobileFilters" hidden><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M4 17h16M9 4v6m6 4v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></button>
            </div>
            <div className="album-heading-identity">
              <button className="album-close" id="albumClose" type="button" aria-label="Back to Pokémon Gym" title="Back to Pokémon Gym">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M19 12H5m6-6-6 6 6 6"/></svg>
              </button>
              <span className="album-heading-icon" aria-hidden="true">
                <svg viewBox="0 0 32 32" fill="none" focusable="false">
                  <path d="M5.5 6.5c3.6-.8 7.1.1 10.5 2.6v17c-3.4-2.5-6.9-3.4-10.5-2.6v-17Z"/>
                  <path d="M26.5 6.5c-3.6-.8-7.1.1-10.5 2.6v17c3.4-2.5 6.9-3.4 10.5-2.6v-17Z"/>
                  <path d="M16 9.1v17"/>
                </svg>
              </span>
              <div>
                <span>Capture archive</span>
                <h2>Pokémon Album</h2>
              </div>
            </div>
            <div className="album-summary sr-only">
              <strong id="albumCount">0</strong>
              <span id="albumFilterName">All</span>
            </div>
            <div className="album-progress-strip">
              <div className="album-progress-stat">
              <button className="progress-toggle" id="progressToggle" type="button" aria-haspopup="dialog" aria-controls="progressDialog" aria-label="Collection progress">Progress</button>
                <span className="album-page-indicator" id="albumPageLabel">Page 1 / 1</span>
              </div>
              <div className="album-progress-bars">
                <label className="album-progress-row"><span>Base</span><progress id="albumTotalProgress" max="1" value="0"></progress><output id="albumTotalProgressLabel">—</output></label>
                <label className="album-progress-row is-shiny"><span>Shiny</span><progress id="albumShinyProgress" max="1" value="0"></progress><output id="albumShinyProgressLabel">—</output></label>
              </div>
            </div>
          </header>
          <div className="album-controls">

            <div className="album-modes" role="group" aria-label="Album view">
              <button type="button" data-album-mode="owned" aria-pressed="true">My Pokémon</button>
              <button type="button" data-album-mode="all" aria-pressed="false">All</button>
            </div>
            <button className="album-current-type" id="albumCurrentType" type="button" hidden aria-label="Clear type filter"></button>
          </div>
          <section className="album-mobile-filters" id="albumMobileFilters" aria-label="Album filters" hidden>
            <nav className="album-mobile-filter-nav" aria-label="Filter navigation">
              <button id="albumMobileFilterBack" type="button" hidden>← Back</button>
              <button id="albumMobileFilterDone" type="button">Show results</button>
            </nav>
            <div id="albumMobileFilterContent"></div>
          </section>
          <div className="album-grid" id="albumGrid" tabIndex="0" aria-label="Pokémon Album. Use Page Up or Page Down to change pages." title="Scroll or use Page Up / Page Down to change pages"></div>
          <div className="album-empty" id="albumEmpty">
            <span className="album-empty-ball pokeball" aria-hidden="true"></span>
            <strong>No captures yet</strong>
            <p>Capture a base or shiny version to add it to the album.</p>
          </div>
          <nav className="album-pagination" aria-label="Album pages">
            <button id="albumPrevious" type="button" aria-label="Previous page" disabled>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="m14.5 5-7 7 7 7"/></svg>
            </button>
            <button id="albumNext" type="button" aria-label="Next page" disabled>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="m9.5 5 7 7-7 7"/></svg>
            </button>
          </nav>
          <span className="sr-only" id="albumStatus" role="status" aria-live="polite"></span>
          <section className="album-detail" id="albumDetail" aria-labelledby="albumDetailTitle" hidden>
            <header className="album-detail-header album-panel-heading">
              <div className="album-heading-identity">
                <span className="album-heading-icon" aria-hidden="true">
                  <svg viewBox="0 0 32 32" fill="none" focusable="false">
                    <path d="M5.5 6.5c3.6-.8 7.1.1 10.5 2.6v17c-3.4-2.5-6.9-3.4-10.5-2.6v-17Z"/>
                    <path d="M26.5 6.5c-3.6-.8-7.1.1-10.5 2.6v17c3.4-2.5 6.9-3.4 10.5-2.6v-17Z"/>
                    <path d="M16 9.1v17"/>
                  </svg>
                </span>
                <div><span>Pokémon Album</span><h2 id="albumDetailTitle">Pokémon Profile</h2></div>
              </div>
              <button id="albumDetailClose" type="button" aria-label="Back to album" title="Back to album"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
            </header>
            <div className="album-detail-body" id="albumDetailBody" aria-live="polite"></div>
          </section>
        </aside>
  );
}
