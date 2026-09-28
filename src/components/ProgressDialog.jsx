import React from "react";

export function ProgressDialog() {
  return (
    <dialog className="progress-dialog" id="progressDialog" aria-labelledby="progressTitle">
      <header className="progress-heading"><div><span className="eyebrow">Capture archive</span><h2 id="progressTitle">Collection progress</h2></div><button id="progressClose" type="button" aria-label="Close progress">&times;</button></header>
      <nav className="progress-tabs" aria-label="Progress sections"><button type="button" data-progress="overview" aria-pressed="true">Overview</button><button type="button" data-progress="generation" aria-pressed="false">Generation</button><button type="button" data-progress="type" aria-pressed="false">Type</button><button type="button" data-progress="category" aria-pressed="false">Category</button></nav>
      <div id="progressContent" className="progress-content" aria-live="polite"></div>
      <nav className="progress-pager" aria-label="Progress pages"><button id="progressPrevious" type="button" aria-label="Previous progress page">&larr;</button><span id="progressPage"></span><button id="progressNext" type="button" aria-label="Next progress page">&rarr;</button></nav>
    </dialog>
  );
}
