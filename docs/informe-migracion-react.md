# Informe de migración y arquitectura — Wikidex · Pokédex React

## 1. Propósito del proyecto

Wikidex es una Pokédex web interactiva orientada a la consulta, exploración y colección de Pokémon. La aplicación conserva una interfaz inspirada en una Pokédex física y combina búsqueda, visualización de artwork, sprites de batalla, variantes Base/Shiny, captura local, álbum, filtros, progreso de colección, perfiles, estadísticas, movimientos, evoluciones y formas.

La aplicación fue estructurada como un proyecto **React 18 + Vite**, manteniendo la identidad visual, las proporciones físicas y los comportamientos aprobados de la interfaz original. La migración priorizó compatibilidad funcional y visual: no se sustituyeron reglas de colección, sprites, almacenamiento o navegación únicamente por simplificar la arquitectura.

## 2. Tecnologías

- React 18.3.1.
- React DOM 18.3.1.
- Vite 5.4.11.
- JavaScript ES Modules.
- CSS nativo con container queries, custom properties y responsive layout.
- TypeScript utilizado como comprobador estático sobre JavaScript/JSX mediante `tsconfig.check.json`.
- Node Test Runner para las pruebas automatizadas.
- PokeAPI y repositorio de sprites de PokeAPI como fuentes de datos remotos.
- `localStorage` para conservar la colección capturada.
- GitHub Actions para validación, build y publicación en GitHub Pages.

No existe un servidor backend propio. La capa equivalente a lógica de datos se encuentra en los módulos de dominio y servicios del cliente; las consultas externas se realizan desde el navegador.

## 3. Organización del repositorio

```text
.github/workflows/      despliegue de GitHub Pages
public/                 CSS y recursos estáticos
scripts/                validaciones de contrato del proyecto
src/
  components/           estructura React de la interfaz
  data/                 metadatos locales del álbum
  domain/               reglas puras de estado, layout y progreso
  hooks/                ciclo de vida del runtime
  runtime/              coordinación de la experiencia interactiva
  services/             persistencia, JSON y fuentes de sprites
  App.jsx                composición principal
  main.jsx               entrada React
tests/                   pruebas automatizadas
types/                   definiciones mínimas para comprobación
index.html               documento Vite
package.json             scripts y dependencias
vite.config.js           configuración de desarrollo/build
```

React es responsable de renderizar la estructura estable de la aplicación. La lógica interactiva compleja se mantiene encapsulada en `pokedexRuntime.js` y en módulos de dominio/servicios para preservar comportamientos visuales que dependen de mediciones reales del DOM, sprites y animaciones.

## 4. Componentes React

La interfaz principal se divide en componentes con responsabilidades claras:

- `App`: composición raíz.
- `DeviceStage`: superficie donde se calcula la relación entre Pokédex y ventanas auxiliares.
- `PokedexDevice`: dispositivo físico.
- `PhysicalShell`: carcasa y geometría exterior.
- `PokedexScreen`: estados Home, búsqueda, Pokémon, Gym y filtros del álbum.
- `SideDrawers`: paneles INFO y STATS.
- `AlbumPanel`: ventana del álbum y Profile.
- `ProgressDialog`: detalle del progreso de colección.

Los IDs históricos utilizados por el runtime se conservan deliberadamente para evitar regresiones en la lógica que mide y coordina elementos concretos.

## 5. Estado y navegación

`createInitialState()` contiene el estado inicial de navegación y álbum. El runtime coordina transiciones entre:

- inicio y búsqueda;
- visualización de Pokémon;
- Base/Shiny;
- Pokémon Gym;
- Pokémon Album;
- filtros;
- Profile;
- Journal;
- Stats;
- Moves;
- Evolution;
- Forms.

Pokémon Casino y Poké Suika se presentan como módulos futuros mediante controles **Coming soon** realmente deshabilitados. No contienen lógica incompleta ni estados ocultos en la entrega.

## 6. Persistencia de capturas

La colección mantiene la clave heredada:

```text
wikidex-captures
```

Cada captura distingue explícitamente la variante:

```text
<ID>:normal
<ID>:shiny
```

Base y Shiny son independientes. La lectura del almacenamiento filtra entradas individuales inválidas sin destruir capturas válidas y evita sobrescribir automáticamente estructuras heredadas incompatibles.

## 7. Sprites, artwork y fallbacks

La pantalla principal y los sprites de batalla utilizan cadenas de fallback separadas.

### Artwork principal

Se prioriza el artwork oficial válido de la forma exacta y después HOME cuando corresponde. No se sustituye una forma por otra visualmente diferente.

### Sprites de batalla

Se mantiene la prioridad definida para Showdown y Generation V, preservando Base/Shiny y forma exacta.

### Ajuste visual

Los sprites pixel art se renderizan con `image-rendering: pixelated` y el runtime calcula la silueta visible a partir de la transparencia. El tamaño y la posición se ajustan al espacio útil real, evitando controles y aprovechando el mayor espacio posible.

En el pase de calidad final, los tamaños y coordenadas de sprites pixelados se redondean a píxeles CSS completos para reducir suavizado accidental durante resize. El artwork de alta resolución conserva interpolación normal.

Cuando ninguna fuente válida existe para una forma, la interfaz muestra `Image not available` en lugar de utilizar otra forma incorrecta.

## 8. Pokédex física y proporciones

La referencia geométrica del dispositivo continúa siendo:

```text
420 × 746
```

La Pokédex escala como una sola unidad. La geometría de la carcasa, domos, pantalla y uniones metálicas permanece coordinada; las zonas negras de las uniones se mantienen retraídas de forma simétrica detrás del borde metálico.

El responsive adapta el dispositivo mediante escala uniforme en lugar de deformar sus piezas.

## 9. Paneles INFO y STATS

Los botones y paneles laterales utilizan una decisión de layout basada en geometría estable:

- si existe espacio suficiente, INFO y STATS permanecen fuera del dispositivo con un margen de seguridad;
- los dos paneles pueden coexistir abiertos cuando ambos caben;
- los botones siguen visibles en modo externo;
- si el espacio no permite paneles completos, el contenido pasa al modo interior;
- cambios de sprite, carga de contenido, animaciones o pequeñas oscilaciones de medición no cambian el modo elegido.

La decisión responsive utiliza dimensiones compensadas frente al zoom del navegador. El pinch-zoom del trackpad no se interpreta como una nueva resolución y no debe provocar que los controles salten de modo exterior a interior.

## 10. Pokémon Gym

Pokémon Gym utiliza un sistema de tarjetas coherente y de baja saturación visual:

- Pokémon Album es la función activa.
- Pokémon Casino muestra una pica simple y `Coming soon`.
- Poké Suika utiliza la misma base gris de iconografía futura y una silueta monocromática oscura de Pikachu derivada del official artwork, con `Coming soon`.

Los módulos futuros están deshabilitados semántica y visualmente; no presentan hover o affordances que sugieran funcionamiento disponible. Los tres accesos del Gym se centran verticalmente como bloque dentro del área útil; el icono de Album es plano y los dos módulos futuros comparten una base gris limpia y sin bordes redundantes.

## 11. Sistema de encabezados

Menús y submenús comparten la misma jerarquía tipográfica:

1. eyebrow o texto contextual pequeño;
2. título principal;
3. control de regreso en una posición predecible.

Gym, filtros, Evolution/Forms y Profile utilizan tokens compartidos para tamaño, interlineado, tracking y separación. La intención es que cambiar de módulo no cambie el lenguaje visual de navegación.

## 12. Pokémon Album

El álbum conserva tarjetas con proporción fija:

```text
4 : 3
```

La cantidad de columnas y filas se calcula con el espacio disponible. El layout agrega filas únicamente cuando una tarjeta completa cabe y evita hacer las tarjetas diminutas para aumentar artificialmente la capacidad de una página.

La grilla mantiene una separación consistente y conserva la alineación visual con el centro de la Poké Ball de fondo. Las etiquetas `Base`, `Shiny` y `Pending` usan capitalización de frase y centrado óptico uniforme. En superficies móviles estrechas recupera espacio vertical del encabezado y la navegación para mostrar una segunda tarjeta completa cuando realmente cabe, sin romper la relación 4:3 ni reducirla a un tamaño ilegible.

El indicador de porcentaje y página se presenta como una única superficie limpia: el número de página está integrado sin un segundo borde decorativo innecesario. Los controles inferiores de paginación conservan un margen de seguridad simétrico respecto al marco exterior incluso en superficies móviles estrechas.

Los textos disponen de reglas de contención y wrapping para que etiquetas más largas no abandonen sus cajas. El diseño principal está optimizado en inglés.

## 13. Pokémon Profile

La carta de colección mantiene su proporción fija:

```text
63 : 88
```

La carta no se modifica por la tematización externa. Journal, Stats, Moves y los menús de Evolution/Forms utilizan el color del tipo del Pokémon como acento. Cuando un Pokémon posee dos tipos, las superficies activas emplean un degradado equilibrado entre ambos.

Los tabs inactivos mantienen superficies claras y discretas para que solo la sección activa tenga protagonismo. Los textos de Journal, Stats, Moves y los metadatos de investigación derivan una jerarquía tonal del tipo activo: títulos y valores usan una mezcla más intensa y las etiquetas secundarias una mezcla más contenida. En Pokémon de dos tipos se conserva un degradado equilibrado en los estados activos, manteniendo contraste y legibilidad.

La carta 63:88 conserva su geometría y tratamiento. El pie de la tarjeta mantiene la firma tipográfica `WikiDex` original, integrada como texto y sin añadir logotipos, contornos ni iconos decorativos. La cubierta de una variante bloqueada conserva la misma marca tipográfica y elimina el icono de libro adicional para reducir ruido visual. Evolution/Forms no añade una superficie rectangular adicional detrás del control segmentado; únicamente permanecen visibles los dos botones.

### Variantes bloqueadas

Una variante no capturada continúa mostrando la cubierta. `View Base` y `View Shiny` permanecen disponibles incluso cuando ninguna de las dos variantes está capturada, permitiendo navegar entre ambas cubiertas. Si la alternativa está capturada, el mismo control lleva a la tarjeta desbloqueada correspondiente.

## 14. Armonización visual

El diseño utiliza un conjunto común de tokens para:

- radios;
- superficies;
- bordes;
- sombras;
- colores de texto;
- controles;
- espaciados;
- velocidades de transición;
- curvas de animación.

La interfaz evita acumulación de contornos, dobles bordes y resaltados simultáneos. El color intenso queda reservado para estados activos, tipos Pokémon y acciones realmente importantes.

Los iconos SVG se fuerzan a un modelo de bloque centrado para evitar desplazamientos provocados por baseline. El control Catch/Release deriva siempre del estado real de captura: una variante no capturada muestra únicamente la Poké Ball; durante la captura o liberación el control conserva su estado inactivo existente; al finalizar una captura la Poké Ball se reduce suavemente al tamaño de Release y la flecha aparece con una transición breve completamente contenida dentro del botón; al liberar, la flecha desaparece y el control vuelve de forma fluida al estado Catch. Cambiar de Pokémon, Base/Shiny o navegación no puede dejar estados visuales heredados. Los scrollbars de investigación se mantienen delgados y armonizados con el tipo activo.

## 15. Loader

El estado de carga utiliza la Poké Ball existente como único elemento gráfico principal. La Poké Ball gira centrada y `Loading...` se muestra debajo con una jerarquía discreta. `prefers-reduced-motion` elimina la rotación automáticamente.

## 16. Responsive

Se cubren los siguientes escenarios mediante escala uniforme, container queries y cálculo de layout:

- escritorio amplio;
- laptops con poca altura;
- tablet;
- móviles alrededor de 390–480 px;
- superficies próximas a 320 px;
- orientación vertical y horizontal;
- redimensionado dinámico.

La regla principal es adaptar el contenedor antes que deformar contenido con proporciones aprobadas.

## 17. Accesibilidad

La aplicación conserva:

- `aria-label` y `aria-pressed` en controles relevantes;
- regiones `aria-live` para estados;
- `inert` para superficies temporalmente no interactivas;
- navegación por teclado;
- foco visible;
- retorno de foco en overlays y Profile;
- `prefers-reduced-motion`;
- botones realmente `disabled` para funciones futuras.

El flujo Album evita aplicar `aria-hidden` sobre un árbol que conserve el foco activo.

## 18. Rendimiento y mantenimiento

El proyecto utiliza:

- caché LRU limitada para consultas JSON;
- caché limitada de mediciones de artwork/sprites;
- cancelación mediante `AbortController`;
- `ResizeObserver` donde la geometría real es necesaria;
- limpieza del runtime durante desmontaje React;
- reutilización de metadatos locales para filtros y progreso;
- carga `async`/`decoding` apropiada de imágenes;
- una sola fuente de decisión para el modo lateral INFO/STATS.

La estructura separa reglas puras (`domain`), acceso a datos (`services`), estructura (`components`) y coordinación DOM (`runtime`).

## 19. Pruebas y contrato del proyecto

Las pruebas automatizadas cubren, entre otros aspectos:

- progreso por especie;
- filtros de variante;
- índice local del álbum;
- geometría 4:3;
- referencia física 420×746;
- responsive del álbum;
- INFO/STATS y márgenes del viewport;
- estabilidad frente al zoom;
- fallbacks de sprites;
- Base/Shiny;
- persistencia;
- Profile y cambio entre variantes cubiertas;
- iconografía y estados Coming soon;
- tematización de menús de Profile;
- nitidez y posicionamiento de sprites;
- simetría de la carcasa;
- sincronización visual de la flecha Capture/Release;
- margen de seguridad de la paginación del Album;
- capitalización y centrado de `Base`, `Shiny` y `Pending`;
- jerarquía cromática por tipo en la información de Profile;
- firma tipográfica `WikiDex` en las tarjetas y ausencia del icono de libro adicional en la cubierta;
- destello de confirmación de captura difuminado y ajustado a la silueta de la Poké Ball, sin cuadros o halos rectangulares;
- transición coherente entre los estados Catch y Release sin modificar la animación principal de captura;
- estado visual inactivo consistente durante captura y liberación.

Validación ejecutada sobre el código entregado:

```text
52 tests
52 pass
0 fail
```

El contrato estructural también pasa:

```text
82 runtime DOM ids resolved
121 unique ids rendered
all 121 original ids preserved
required assets verified
```

El CSS fue analizado mediante parser después del pase final y no presenta errores de sintaxis.

## 20. Scripts

Instalación:

```bash
npm install
```

Pruebas:

```bash
npm test
```

Contrato/sintaxis:

```bash
npm run check
```

Build:

```bash
npm run build
```

Verificación completa:

```bash
npm run verify
```

Desarrollo:

```bash
npm run dev
```

Preview de producción:

```bash
npm run preview
```

## 21. GitHub Pages

`.github/workflows/deploy-pages.yml` ejecuta en cada push a `main`:

1. checkout;
2. Node 22;
3. `npm ci`;
4. pruebas;
5. comprobación estructural;
6. build Vite;
7. publicación de `dist` en GitHub Pages.

Vite utiliza rutas relativas (`base: "./"`) para que los assets funcionen bajo la subruta del repositorio.

## 22. Estado de entrega

El repositorio contiene únicamente la aplicación React, configuración, assets necesarios, pruebas y documentación. No se incluyen `node_modules`, `dist`, cachés, capturas de trabajo ni archivos temporales.

La comprobación `npm run build` requiere las dependencias nativas correctas para el sistema operativo. En el entorno de empaquetado se pudo ejecutar toda la suite de pruebas y `npm run check`, pero Rollup no dispone de su dependencia nativa opcional para Linux, por lo que el build final debe ejecutarse tras `npm install` en el equipo de entrega; el workflow de GitHub Pages realiza esa misma validación antes de desplegar.
