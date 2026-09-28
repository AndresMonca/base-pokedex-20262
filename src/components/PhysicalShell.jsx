import React from "react";

export function PhysicalShell() {
  return (
    <>
          <section className="shell-half shell-upper" aria-hidden="true">
            <svg className="shell-art" preserveAspectRatio="none" viewBox="0 0 1000 400" fill="none" focusable="false">
              <defs>
                <clipPath id="u-glass-clip"><path d="M173.771552 384A24 24 0 0 0 195.826433 369.464789A331 331 0 0 1 804.173567 369.464789A24 24 0 0 0 826.228448 384V402H173.771552Z"/></clipPath>
                <linearGradient id="u-glass-reflection" x1="330" y1="165" x2="530" y2="400" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#f1f4f4" stopOpacity=".33"/><stop offset=".55" stopColor="#d5dede" stopOpacity=".17"/><stop offset="1" stopColor="#bbc7ca" stopOpacity=".06"/>
                </linearGradient>
                <mask id="u-edge-notches" maskUnits="userSpaceOnUse" x="-20" y="-20" width="1040" height="440" style={{ maskType: "luminance" }}>
                  <rect x="-20" y="-20" width="1040" height="440" fill="white"/>
                  <g fill="black"><rect x="-2" y="133" width="5" height="12" rx="1.8"/><rect x="-2" y="263" width="5" height="12" rx="1.8"/><rect x="-2" y="361.5" width="5" height="24" rx="1.8"/><g transform="translate(1000 0) scale(-1 1)"><rect x="-2" y="133" width="5" height="12" rx="1.8"/><rect x="-2" y="263" width="5" height="12" rx="1.8"/><rect x="-2" y="361.5" width="5" height="24" rx="1.8"/></g></g>
                </mask>
                <linearGradient id="u-side-depth" x1="4" y1="0" x2="996" y2="0" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#210d18" stopOpacity=".5"/>
                  <stop offset=".008" stopColor="#351021" stopOpacity=".32"/>
                  <stop offset=".019" stopColor="#48152a" stopOpacity=".12"/>
                  <stop offset=".037" stopColor="#48152a" stopOpacity="0"/>
                  <stop offset=".963" stopColor="#351021" stopOpacity="0"/>
                  <stop offset=".981" stopColor="#351021" stopOpacity=".16"/>
                  <stop offset=".992" stopColor="#260d1a" stopOpacity=".38"/>
                  <stop offset="1" stopColor="#210d18" stopOpacity=".55"/>
                </linearGradient>
                <filter id="u-contour-soft" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB"><feGaussianBlur stdDeviation="2.4"/></filter>
                <filter id="u-detail-soft" x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB"><feGaussianBlur stdDeviation="1.2"/></filter>
                <radialGradient id="u-lacquer" cx=".32" cy=".06" r=".9" gradientTransform="translate(0 -.04) scale(1 1.15)">
                  <stop stopColor="#ffe3df" stopOpacity=".28"/><stop offset=".48" stopColor="#fca2af" stopOpacity=".035"/><stop offset="1" stopColor="#4c061d" stopOpacity=".18"/>
                </radialGradient>
                <linearGradient id="u-reflection" x1=".1" y1="0" x2=".65" y2="1">
                  <stop stopColor="#fff4ef" stopOpacity=".2"/><stop offset=".65" stopColor="#ffb9c3" stopOpacity=".06"/><stop offset="1" stopColor="#ffb9c3" stopOpacity="0"/>
                </linearGradient>
                <filter id="u-reflection-soft" x="-10%" y="-20%" width="120%" height="140%"><feGaussianBlur stdDeviation="7"/></filter>
                <filter id="u-micrograin" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
                  <feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" seed="8" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/>
                </filter>
                <linearGradient id="u-red" x1="120" y1="0" x2="820" y2="440" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#d96070"/><stop offset=".24" stopColor="#d52d46"/><stop offset=".55" stopColor="#c81032"/><stop offset=".82" stopColor="#ac0929"/><stop offset="1" stopColor="#780b24"/>
                </linearGradient>
                <linearGradient id="u-edge" x1="0" y1="0" x2="0" y2="400" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#f1a3ad"/><stop offset=".09" stopColor="#df5368"/><stop offset=".65" stopColor="#950d29"/><stop offset="1" stopColor="#530f21"/>
                </linearGradient>
                <filter id="u-metal-soft" x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB"><feGaussianBlur stdDeviation="1.6"/></filter>
                <linearGradient id="u-black" x1="300" y1="180" x2="700" y2="490" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#45494b"/><stop offset=".35" stopColor="#2c2f31"/><stop offset=".7" stopColor="#1c1e20"/><stop offset="1" stopColor="#25282a"/>
                </linearGradient>
                <linearGradient id="u-bevel" x1="0" y1="0" x2="1" y2="0">
                  <stop stopColor="#300816" stopOpacity=".6"/><stop offset=".025" stopColor="#ffb3c7" stopOpacity=".4"/><stop offset=".075" stopColor="#e52648" stopOpacity="0"/><stop offset=".92" stopColor="#a50022" stopOpacity="0"/><stop offset=".98" stopColor="#73051c" stopOpacity=".4"/><stop offset="1" stopColor="#300816" stopOpacity=".7"/>
                </linearGradient>
                <radialGradient id="u-screw" cx=".32" cy=".22" r=".8">
                  <stop stopColor="#c0b5b9"/><stop offset=".45" stopColor="#73616a"/><stop offset="1" stopColor="#29202a"/>
                </radialGradient>
                <clipPath id="u-clip"><path d="M105 4H895Q996 4 996 105V384H4V105Q4 4 105 4Z"/></clipPath>
              </defs>
              <g mask="url(#u-edge-notches)">
                <path className="shell-body" d="M105 4H895Q996 4 996 105V384H4V105Q4 4 105 4Z" fill="url(#u-red)" stroke="#321820" strokeWidth="8"/>
                <g clipPath="url(#u-clip)">
                  <path d="M11 394V106Q11 11 106 11H894Q989 11 989 106V394" stroke="url(#u-edge)" strokeWidth="9" filter="url(#u-contour-soft)"/>
                  <path d="M22 388V110Q22 23 110 23H888" stroke="#ffd6da" strokeOpacity=".32" strokeWidth="3" filter="url(#u-contour-soft)"/>
                  <path d="M4 4H996V400H4Z" fill="url(#u-lacquer)"/>
                  <path d="M-20 10H850Q720 76 564 111T-20 211Z" fill="url(#u-reflection)" filter="url(#u-reflection-soft)"/>
                  <path d="M4 4H996V400H4Z" filter="url(#u-micrograin)" opacity=".045" style={{ mixBlendMode: "soft-light" }}/>
                  <path d="M4 4H996V400H4Z" fill="url(#u-bevel)"/>
                  <g className="shell-corners" strokeLinecap="round">
                    <path d="M139 3A139 139 0 0 1 3 139M269 3A269 269 0 0 1 3 269M861 3A139 139 0 0 0 997 139M731 3A269 269 0 0 0 997 269" stroke="#75172c" strokeOpacity=".8" strokeWidth="23" filter="url(#u-contour-soft)"/>
                    <path d="M139 3A139 139 0 0 1 3 139M269 3A269 269 0 0 1 3 269M861 3A139 139 0 0 0 997 139M731 3A269 269 0 0 0 997 269" stroke="#351b25" strokeWidth="12"/>
                    <path d="M149 3A149 149 0 0 1 3 149M279 3A279 279 0 0 1 3 279M851 3A149 149 0 0 0 997 149M721 3A279 279 0 0 0 997 279" stroke="#f28b9a" strokeOpacity=".48" strokeWidth="4" filter="url(#u-contour-soft)"/>
                  </g>
                  <path className="shell-side-depth" d="M4 4H996V400H4Z" fill="url(#u-side-depth)"/>
                </g>
                <g className="shell-fastener">
                  <circle cx="500" cy="137" r="27" fill="#68152b" stroke="#dc6077" strokeOpacity=".45" strokeWidth="2" filter="url(#u-contour-soft)"/>
                  <circle cx="500" cy="137" r="23" fill="#351b25" stroke="#8c2940" strokeWidth="3" filter="url(#u-detail-soft)"/>
                </g>
                <g className="shell-ring">
                  <g className="shell-rim" clipPath="url(#u-clip)" strokeLinejoin="round" strokeLinecap="round">
                    <path d="M7 384H173.771552A24 24 0 0 0 195.826433 369.464789A331 331 0 0 1 804.173567 369.464789A24 24 0 0 0 826.228448 384H993" stroke="#ed7185" strokeOpacity=".3" strokeWidth="60" filter="url(#u-contour-soft)"/>
                    <path d="M7 384H173.771552A24 24 0 0 0 195.826433 369.464789A331 331 0 0 1 804.173567 369.464789A24 24 0 0 0 826.228448 384H993" stroke="#68152b" strokeWidth="56" filter="url(#u-contour-soft)"/>
                    <path d="M7 384H173.771552A24 24 0 0 0 195.826433 369.464789A331 331 0 0 1 804.173567 369.464789A24 24 0 0 0 826.228448 384H993" stroke="#351b25" strokeWidth="45"/>
                    <path d="M7 384H173.771552A24 24 0 0 0 195.826433 369.464789A331 331 0 0 1 804.173567 369.464789A24 24 0 0 0 826.228448 384H993" stroke="url(#u-side-depth)" strokeWidth="60"/>
                  </g>
                  <g className="shell-fastener-face">
                    <circle cx="500" cy="137" r="23" fill="#351b25"/>
                    <circle cx="500" cy="137" r="10" fill="url(#u-screw)"/>
                    <ellipse cx="497" cy="134" rx="3" ry="2.5" fill="#eadcde" opacity=".45" filter="url(#u-detail-soft)"/>
                  </g>
                  <path className="ring-seat" d="M173.771552 384A24 24 0 0 0 195.826433 369.464789A331 331 0 0 1 804.173567 369.464789A24 24 0 0 0 826.228448 384V402H173.771552Z" transform="translate(0 -2)" fill="url(#u-black)"/>
                  <path className="glass-reflection" d="M0 0H909.091L581.818 400H0Z" fill="url(#u-glass-reflection)" clipPath="url(#u-glass-clip)"/>
                  <path className="metal-outline" d="M120 384H173.771552A24 24 0 0 0 195.826433 369.464789A331 331 0 0 1 804.173567 369.464789A24 24 0 0 0 826.228448 384H880" stroke="#526267" strokeWidth="21" strokeLinejoin="round"/>
                  <path className="metal-body" d="M120 384H173.771552A24 24 0 0 0 195.826433 369.464789A331 331 0 0 1 804.173567 369.464789A24 24 0 0 0 826.228448 384H880" stroke="#c9d5d9" strokeWidth="17" strokeLinejoin="round"/>
                  <path className="metal-highlight" d="M120 384H173.771552A24 24 0 0 0 195.826433 369.464789A331 331 0 0 1 804.173567 369.464789A24 24 0 0 0 826.228448 384H880" transform="translate(0 -2)" stroke="#f5fbfc" strokeOpacity=".78" strokeWidth="7" strokeLinejoin="round" filter="url(#u-metal-soft)"/>
                  <path className="metal-shade" d="M120 384H173.771552A24 24 0 0 0 195.826433 369.464789A331 331 0 0 1 804.173567 369.464789A24 24 0 0 0 826.228448 384H880" transform="translate(0 4)" stroke="#718991" strokeOpacity=".48" strokeWidth="4" strokeLinejoin="round" filter="url(#u-metal-soft)"/>
                  <path d="M207.972604 399A309 309 0 0 1 792.027396 399" stroke="#a0a6a6" strokeOpacity=".3" strokeWidth="2" filter="url(#u-detail-soft)"/>
                </g>
              </g>
            </svg>
          </section>
          <section className="shell-half shell-lower" aria-hidden="true">
            <svg className="shell-art" preserveAspectRatio="none" viewBox="0 0 1000 400" fill="none" focusable="false">
              <defs>
                <clipPath id="l-glass-clip"><path d="M173.771552 384A24 24 0 0 0 195.826433 369.464789A331 331 0 0 1 804.173567 369.464789A24 24 0 0 0 826.228448 384V402H173.771552Z"/></clipPath>
                <linearGradient id="l-glass-reflection" x1="330" y1="165" x2="530" y2="400" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#f1f4f4" stopOpacity=".33"/><stop offset=".55" stopColor="#d5dede" stopOpacity=".17"/><stop offset="1" stopColor="#bbc7ca" stopOpacity=".06"/>
                </linearGradient>
                <mask id="l-edge-notches" maskUnits="userSpaceOnUse" x="-20" y="-20" width="1040" height="440" style={{ maskType: "luminance" }}>
                  <rect x="-20" y="-20" width="1040" height="440" fill="white"/>
                  <g fill="black"><rect x="-2" y="133" width="5" height="12" rx="1.8"/><rect x="-2" y="263" width="5" height="12" rx="1.8"/><rect x="-2" y="361.5" width="5" height="24" rx="1.8"/><g transform="translate(1000 0) scale(-1 1)"><rect x="-2" y="133" width="5" height="12" rx="1.8"/><rect x="-2" y="263" width="5" height="12" rx="1.8"/><rect x="-2" y="361.5" width="5" height="24" rx="1.8"/></g></g>
                </mask>
                <linearGradient id="l-side-depth" x1="4" y1="0" x2="996" y2="0" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#210d18" stopOpacity=".5"/>
                  <stop offset=".008" stopColor="#351021" stopOpacity=".32"/>
                  <stop offset=".019" stopColor="#48152a" stopOpacity=".12"/>
                  <stop offset=".037" stopColor="#48152a" stopOpacity="0"/>
                  <stop offset=".963" stopColor="#351021" stopOpacity="0"/>
                  <stop offset=".981" stopColor="#351021" stopOpacity=".16"/>
                  <stop offset=".992" stopColor="#260d1a" stopOpacity=".38"/>
                  <stop offset="1" stopColor="#210d18" stopOpacity=".55"/>
                </linearGradient>
                <filter id="l-contour-soft" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB"><feGaussianBlur stdDeviation="2.4"/></filter>
                <filter id="l-detail-soft" x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB"><feGaussianBlur stdDeviation="1.2"/></filter>
                <radialGradient id="l-lacquer" cx=".32" cy=".06" r=".9" gradientTransform="translate(0 -.04) scale(1 1.15)">
                  <stop stopColor="#ffe3df" stopOpacity=".28"/><stop offset=".48" stopColor="#fca2af" stopOpacity=".035"/><stop offset="1" stopColor="#4c061d" stopOpacity=".18"/>
                </radialGradient>
                <linearGradient id="l-reflection" x1=".1" y1="0" x2=".65" y2="1">
                  <stop stopColor="#fff4ef" stopOpacity=".2"/><stop offset=".65" stopColor="#ffb9c3" stopOpacity=".06"/><stop offset="1" stopColor="#ffb9c3" stopOpacity="0"/>
                </linearGradient>
                <filter id="l-reflection-soft" x="-10%" y="-20%" width="120%" height="140%"><feGaussianBlur stdDeviation="7"/></filter>
                <filter id="l-micrograin" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
                  <feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" seed="8" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/>
                </filter>
                <linearGradient id="l-red" x1="120" y1="0" x2="820" y2="440" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#d96070"/><stop offset=".24" stopColor="#d52d46"/><stop offset=".55" stopColor="#c81032"/><stop offset=".82" stopColor="#ac0929"/><stop offset="1" stopColor="#780b24"/>
                </linearGradient>
                <linearGradient id="l-edge" x1="0" y1="0" x2="0" y2="400" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#f1a3ad"/><stop offset=".09" stopColor="#df5368"/><stop offset=".65" stopColor="#950d29"/><stop offset="1" stopColor="#530f21"/>
                </linearGradient>
                <filter id="l-metal-soft" x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB"><feGaussianBlur stdDeviation="1.6"/></filter>
                <linearGradient id="l-black" x1="300" y1="180" x2="700" y2="490" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#45494b"/><stop offset=".35" stopColor="#2c2f31"/><stop offset=".7" stopColor="#1c1e20"/><stop offset="1" stopColor="#25282a"/>
                </linearGradient>
                <linearGradient id="l-bevel" x1="0" y1="0" x2="1" y2="0">
                  <stop stopColor="#300816" stopOpacity=".6"/><stop offset=".025" stopColor="#ffb3c7" stopOpacity=".4"/><stop offset=".075" stopColor="#e52648" stopOpacity="0"/><stop offset=".92" stopColor="#a50022" stopOpacity="0"/><stop offset=".98" stopColor="#73051c" stopOpacity=".4"/><stop offset="1" stopColor="#300816" stopOpacity=".7"/>
                </linearGradient>
                <radialGradient id="l-screw" cx=".32" cy=".22" r=".8">
                  <stop stopColor="#c0b5b9"/><stop offset=".45" stopColor="#73616a"/><stop offset="1" stopColor="#29202a"/>
                </radialGradient>
                <clipPath id="l-clip"><path d="M105 4H895Q996 4 996 105V384H4V105Q4 4 105 4Z"/></clipPath>
              </defs>
              <g mask="url(#l-edge-notches)" transform="translate(1000 400) rotate(180)">
                <path className="shell-body" d="M105 4H895Q996 4 996 105V384H4V105Q4 4 105 4Z" fill="url(#l-red)" stroke="#321820" strokeWidth="8"/>
                <g clipPath="url(#l-clip)">
                  <path d="M11 394V106Q11 11 106 11H894Q989 11 989 106V394" stroke="url(#l-edge)" strokeWidth="9" filter="url(#l-contour-soft)"/>
                  <path d="M22 388V110Q22 23 110 23H888" stroke="#ffd6da" strokeOpacity=".32" strokeWidth="3" filter="url(#l-contour-soft)"/>
                  <path d="M4 4H996V400H4Z" fill="url(#l-lacquer)"/>
                  <path d="M-20 10H850Q720 76 564 111T-20 211Z" fill="url(#l-reflection)" filter="url(#l-reflection-soft)"/>
                  <path d="M4 4H996V400H4Z" filter="url(#l-micrograin)" opacity=".045" style={{ mixBlendMode: "soft-light" }}/>
                  <path d="M4 4H996V400H4Z" fill="url(#l-bevel)"/>
                  <g className="shell-corners" strokeLinecap="round">
                    <path d="M139 3A139 139 0 0 1 3 139M269 3A269 269 0 0 1 3 269M861 3A139 139 0 0 0 997 139M731 3A269 269 0 0 0 997 269" stroke="#75172c" strokeOpacity=".8" strokeWidth="23" filter="url(#l-contour-soft)"/>
                    <path d="M139 3A139 139 0 0 1 3 139M269 3A269 269 0 0 1 3 269M861 3A139 139 0 0 0 997 139M731 3A269 269 0 0 0 997 269" stroke="#351b25" strokeWidth="12"/>
                    <path d="M149 3A149 149 0 0 1 3 149M279 3A279 279 0 0 1 3 279M851 3A149 149 0 0 0 997 149M721 3A279 279 0 0 0 997 279" stroke="#f28b9a" strokeOpacity=".48" strokeWidth="4" filter="url(#l-contour-soft)"/>
                  </g>
                  <path className="shell-side-depth" d="M4 4H996V400H4Z" fill="url(#l-side-depth)"/>
                </g>
                <g className="shell-fastener">
                  <circle cx="500" cy="137" r="27" fill="#68152b" stroke="#dc6077" strokeOpacity=".45" strokeWidth="2" filter="url(#l-contour-soft)"/>
                  <circle cx="500" cy="137" r="23" fill="#351b25" stroke="#8c2940" strokeWidth="3" filter="url(#l-detail-soft)"/>
                </g>
                <g className="shell-ring">
                  <g className="shell-rim" clipPath="url(#l-clip)" strokeLinejoin="round" strokeLinecap="round">
                    <path d="M7 384H173.771552A24 24 0 0 0 195.826433 369.464789A331 331 0 0 1 804.173567 369.464789A24 24 0 0 0 826.228448 384H993" stroke="#ed7185" strokeOpacity=".3" strokeWidth="60" filter="url(#l-contour-soft)"/>
                    <path d="M7 384H173.771552A24 24 0 0 0 195.826433 369.464789A331 331 0 0 1 804.173567 369.464789A24 24 0 0 0 826.228448 384H993" stroke="#68152b" strokeWidth="56" filter="url(#l-contour-soft)"/>
                    <path d="M7 384H173.771552A24 24 0 0 0 195.826433 369.464789A331 331 0 0 1 804.173567 369.464789A24 24 0 0 0 826.228448 384H993" stroke="#351b25" strokeWidth="45"/>
                    <path d="M7 384H173.771552A24 24 0 0 0 195.826433 369.464789A331 331 0 0 1 804.173567 369.464789A24 24 0 0 0 826.228448 384H993" stroke="url(#l-side-depth)" strokeWidth="60"/>
                  </g>
                  <g className="shell-fastener-face">
                    <circle cx="500" cy="137" r="23" fill="#351b25"/>
                    <circle cx="500" cy="137" r="10" fill="url(#l-screw)"/>
                    <ellipse cx="497" cy="134" rx="3" ry="2.5" fill="#eadcde" opacity=".45" filter="url(#l-detail-soft)"/>
                  </g>
                  <path className="ring-seat" d="M173.771552 384A24 24 0 0 0 195.826433 369.464789A331 331 0 0 1 804.173567 369.464789A24 24 0 0 0 826.228448 384V398H173.771552Z" transform="translate(0 2)" fill="url(#l-black)"/>
                  <path className="glass-reflection" d="M1000 0H909.091L581.818 400H1000Z" fill="url(#l-glass-reflection)" clipPath="url(#l-glass-clip)"/>
                  <path className="metal-outline" d="M120 384H173.771552A24 24 0 0 0 195.826433 369.464789A331 331 0 0 1 804.173567 369.464789A24 24 0 0 0 826.228448 384H880" stroke="#526267" strokeWidth="21" strokeLinejoin="round"/>
                  <path className="metal-body" d="M120 384H173.771552A24 24 0 0 0 195.826433 369.464789A331 331 0 0 1 804.173567 369.464789A24 24 0 0 0 826.228448 384H880" stroke="#c9d5d9" strokeWidth="17" strokeLinejoin="round"/>
                  <path className="metal-highlight" d="M120 384H173.771552A24 24 0 0 0 195.826433 369.464789A331 331 0 0 1 804.173567 369.464789A24 24 0 0 0 826.228448 384H880" transform="translate(0 -2)" stroke="#f5fbfc" strokeOpacity=".78" strokeWidth="7" strokeLinejoin="round" filter="url(#l-metal-soft)"/>
                  <path className="metal-shade" d="M120 384H173.771552A24 24 0 0 0 195.826433 369.464789A331 331 0 0 1 804.173567 369.464789A24 24 0 0 0 826.228448 384H880" transform="translate(0 4)" stroke="#718991" strokeOpacity=".48" strokeWidth="4" strokeLinejoin="round" filter="url(#l-metal-soft)"/>
                  <path d="M207.972604 399A309 309 0 0 1 792.027396 399" stroke="#a0a6a6" strokeOpacity=".3" strokeWidth="2" filter="url(#l-detail-soft)"/>
                </g>
              </g>
            </svg>
          </section>
    </>
  );
}
