# Informe de migración a React — Wikidex / Pokédex

**Proyecto:** Wikidex · Pokédex Pokémon  
**Resultado técnico:** React 18 + Vite  
**Objetivo:** migrar la aplicación original a React conservando el diseño aprobado, las funciones existentes, los datos guardados, los recursos, las reglas de negocio y las proporciones visuales.

---

## 1. Objetivo y alcance

La migración se planteó como un cambio de implementación, no como un rediseño. La aplicación debía continuar comportándose como la versión original, pero quedar organizada como un proyecto React instalable, verificable y compilable.

Las prioridades de la migración fueron:

1. No perder ni transformar indebidamente las capturas guardadas del usuario.
2. Conservar la navegación y las relaciones entre Pokédex, Pokémon Gym, Pokémon Album y Pokémon Profile.
3. Mantener las proporciones y geometrías aprobadas.
4. Mantener assets, colores, tipografía, animaciones, audio, sprites y fallbacks.
5. Separar responsabilidades para mejorar mantenimiento y pruebas.
6. Corregir defectos pequeños de accesibilidad, responsive, geometría y estados sin cambiar la identidad visual.

---

## 2. Estado inicial del proyecto

La aplicación original estaba desarrollada con HTML, CSS y JavaScript vanilla. Su comportamiento estaba concentrado principalmente en tres archivos grandes:

- `index.html`: estructura completa de la interfaz.
- `script.js`: aproximadamente 4.000 líneas de navegación, estado, red, persistencia, sprites, animaciones, audio, filtros y responsive.
- `style.css`: más de 7.000 líneas con el diseño completo y varias capas históricas de overrides.

La versión inicial no disponía de una base React, build con Vite ni una suite automatizada para los contratos funcionales más sensibles.

Antes de migrar se identificaron las principales fuentes de verdad y dependencias del DOM para evitar regresiones durante la separación en componentes.

---

## 3. Estrategia de migración

La migración se realizó de forma conservadora.

En lugar de reescribir simultáneamente toda la aplicación, React asumió primero la estructura de las superficies principales manteniendo los identificadores y contratos de DOM requeridos por la lógica existente. A partir de esa base se separaron reglas puras y servicios que podían aislarse sin cambiar comportamiento.

La estrategia final fue:

- React controla la estructura principal y el ciclo de vida de la aplicación.
- Los componentes representan las superficies visuales principales.
- Reglas de dominio, persistencia, datos y selección de sprites se separaron en módulos independientes.
- El runtime conserva la coordinación de las interacciones visuales complejas que dependen de mediciones, canvas, audio, observers y relaciones históricas del DOM.
- `usePokedexRuntime()` conecta ese coordinador con el montaje y desmontaje de React.

Esta solución permitió migrar la aplicación sin mantener dos interfaces completas en paralelo y sin alterar el resultado visual aprobado.

---

## 4. Tecnología final

La aplicación utiliza:

- React `18.3.1`.
- ReactDOM `18.3.1`.
- Vite `5.4.11`.
- JavaScript / JSX.
- CSS existente consolidado como hoja activa del proyecto.
- `node:test` para pruebas automáticas.
- TypeScript únicamente como comprobación estática de JSX/JavaScript mediante `tsconfig.check.json`.
- GitHub Actions para comprobar y publicar el proyecto en GitHub Pages.

No se introdujo un framework CSS ni una segunda herramienta de estilos para evitar una migración adicional innecesaria.

---

## 5. Organización final del repositorio

```text
.github/workflows/
  deploy-pages.yml

docs/
  informe-migracion-react.md

public/
  assets/
  style.css

scripts/
  check-project.mjs
  original-dom-ids.json

src/
  components/
  data/
  domain/
  hooks/
  runtime/
  services/
  App.jsx
  main.jsx

tests/
types/
index.html
package.json
package-lock.json
tsconfig.check.json
vite.config.js
README.md
.gitignore
```

Se excluyen del repositorio `node_modules`, `dist`, cachés y archivos temporales porque se generan localmente o durante el despliegue.

---

## 6. Componentes React

La estructura visible se dividió por responsabilidades reales, evitando convertir cada elemento trivial en un componente separado.

### `App.jsx`

Monta el escenario general y activa el runtime mediante el hook de integración.

### `DeviceStage.jsx`

Agrupa la Pokédex física y las superficies que comparten el escenario principal.

### `PokedexDevice.jsx`

Representa la unidad general del dispositivo.

### `PhysicalShell.jsx`

Contiene la geometría visual de la carcasa y sus piezas SVG.

### `PokedexScreen.jsx`

Renderiza la pantalla principal, controles, zonas de información y superficies internas.

### `AlbumPanel.jsx`

Contiene la estructura del Pokémon Album y los controles relacionados con búsqueda, filtros, progreso y navegación.

### `SideDrawers.jsx`

Representa INFO y STATS y conserva sus relaciones con la pantalla principal.

### `ProgressDialog.jsx`

Monta la ventana de estadísticas/progreso de colección.

---

## 7. Dominio, servicios y runtime

Se separaron reglas que anteriormente estaban mezcladas con manipulación del DOM.

### `src/domain/`

Contiene reglas puras de:

- estado inicial;
- progreso de colección;
- geometría/layout;
- normalización de texto.

### `src/services/`

Contiene:

- persistencia de capturas;
- cliente JSON;
- selección y orden de fuentes de sprites.

### `src/data/albumFilterIndex.js`

Contiene el catálogo local utilizado por Album y filtros. Se integra como módulo del proyecto y ya no depende de un script global fuera del bundle de Vite.

### `src/runtime/pokedexRuntime.js`

Continúa coordinando las interacciones complejas que requieren acceso directo al DOM o al navegador, entre ellas:

- observers;
- mediciones reales;
- canvas;
- audio;
- temporizadores;
- foco;
- animaciones;
- navegación visual;
- carga y sincronización de datos.

El runtime se mantuvo deliberadamente como coordinador durante la migración para evitar reescribir de forma riesgosa miles de líneas de comportamiento ya aprobado.

---

## 8. Contrato del DOM y compatibilidad

Una parte importante de la aplicación original dependía de IDs concretos.

Durante la migración esos IDs se preservaron mientras React asumía la estructura. El proyecto incorpora una comprobación automática que detecta si se elimina o duplica un ID requerido por el runtime.

Resultado actual:

```text
82 runtime DOM ids resolved
121 unique ids rendered
121 original ids preserved
```

Esto permite continuar reduciendo la dependencia imperativa en el futuro sin haber roto el comportamiento durante la migración inicial.

---

## 9. Estado y sincronización

Se conservaron las fuentes de verdad necesarias para:

- pantalla activa;
- apertura/cierre del Gym;
- apertura/cierre del Album;
- Pokémon seleccionado;
- especie y forma;
- Base/Shiny;
- colección;
- búsqueda;
- filtros;
- página;
- pestaña del Profile;
- selección y modo del carrusel.

Las actualizaciones relacionadas se mantienen coordinadas para evitar estados incompatibles, por ejemplo:

- nombre de una forma con sprite de otra;
- Profile de un Pokémon con Journal de otro;
- carta Shiny con carrusel Base;
- página fuera del rango después de redimensionar;
- cubierta aplicada a la variante equivocada.

Las solicitudes que dejan de corresponder con la selección activa se cancelan o se ignoran para impedir que respuestas antiguas sobrescriban estados recientes.

---

## 10. Persistencia y compatibilidad de capturas

La migración conserva la clave histórica:

```text
wikidex-captures
```

También conserva la identificación independiente de Base y Shiny:

```text
ID:normal
ID:shiny
```

Por lo tanto:

- capturar Base no captura Shiny;
- capturar Shiny no reemplaza Base;
- recargar la aplicación conserva las capturas;
- no se reinicia automáticamente la colección al montar React;
- valores legacy que no pueden interpretarse de forma segura no se destruyen silenciosamente.

La persistencia fue comprobada tanto mediante pruebas automatizadas como durante la validación manual en navegador.

---

## 11. Progreso: especies y formas

El catálogo puede contener especies y formas alternativas, pero el progreso global no debe inflarse por registrar múltiples formas de una misma especie.

La lógica migrada conserva esta diferencia:

- las formas pueden mostrarse y gestionarse individualmente;
- el denominador del progreso general se calcula por especies según la regla original;
- filtros Base/Shiny modifican lo poseído sin alterar indebidamente el denominador.

---

## 12. Datos y red

Se conservaron las fuentes remotas utilizadas por el proyecto y el comportamiento de PokeAPI.

El cliente de datos mantiene:

- reutilización de respuestas cuando corresponde;
- estados de carga;
- manejo de error;
- cancelación/ignorancia de solicitudes obsoletas;
- recuperación sin bloquear permanentemente Profile o navegación.

El índice local del Album reduce dependencia de solicitudes repetidas para operaciones que pueden resolverse con metadata ya incluida en el proyecto.

---

## 13. Artwork principal y sprites

La migración conserva cadenas distintas para artwork principal y sprites de batalla.

### Pantalla principal de la Pokédex

Prioridad:

1. Official Artwork válido para esa forma y variante.
2. HOME de esa misma forma y variante.

Normal nunca se sustituye por Shiny y Shiny nunca se sustituye por Normal.

### Battle Sprite

Prioridad:

1. Battle Showdown Animated.
2. Battle Showdown Static.
3. Generation V Black/White Animated.
4. Generation V Black/White Static.
5. Mejor sprite estático válido para esa forma exacta.

Nunca se utiliza otra forma para rellenar un recurso ausente.

### Recurso inexistente

Cuando se agotan los fallbacks válidos de la forma/variante exacta, la interfaz muestra el texto en inglés:

```text
Image not available
```

El mensaje se centra en el espacio reservado para la imagen sin inventar un sprite alternativo.

---

## 14. Centrado y medición de sprites

Se conservó el sistema de medición de transparencia porque el lienzo de una imagen no siempre coincide con la silueta visual del Pokémon.

La aplicación calcula límites visibles para:

- centrar la silueta real;
- aprovechar el espacio disponible;
- conservar proporción;
- evitar recortes;
- evitar colisiones con controles;
- mantener alineado el fondo gráfico con el mismo centro visual.

Estas mediciones se reutilizan cuando es posible para evitar trabajo repetido durante renders y transiciones.

---

## 15. Proporciones visuales conservadas

Las siguientes relaciones se consideran contratos del proyecto:

- Pokédex: referencia geométrica `420 × 746`.
- Escalado general de la Pokédex: uniforme.
- Tarjetas del Album: `4:3`.
- Carta de Pokémon Profile: `63:88`.
- Carta con movimientos: distribución aproximada `12% / 48% / 40%`.
- Carta sin movimientos: distribución aproximada `12% / 58% / 30%`.

El responsive puede reorganizar el espacio exterior, pero no cambia arbitrariamente estas relaciones para forzar contenido.

---

## 16. INFO y STATS

Los controles laterales utilizan espacio real disponible, no un breakpoint genérico.

Regla final:

- INFO permanece a la izquierda.
- STATS permanece a la derecha.
- Ambos se mantienen fuera de la pantalla cuando caben con un margen seguro respecto al viewport.
- Si el espacio deja de ser suficiente, pasan al interior.
- La decisión se recalcula al redimensionar.

Su diseño, orientación y proporciones se conservaron.

---

## 17. Carcasa física

La carcasa se mantiene como una unidad de proporciones fijas.

Durante la migración se corrigió la pequeña asimetría visible en las cuatro uniones del asiento negro central con el borde metálico. La geometría oscura queda retraída de forma simétrica bajo el metal sin modificar:

- piezas rojas;
- borde plateado;
- gradientes;
- brillo;
- sombras;
- relación general del dispositivo.

La suite incluye una prueba específica de simetría para proteger este contrato.

---

## 18. Pokémon Album

Se conservaron:

- My Pokémon y All Pokémon;
- búsqueda;
- filtros combinables;
- Base/Shiny;
- categorías;
- generación;
- tipos;
- progreso;
- paginación;
- Profile desde tarjeta;
- capacidad dinámica de filas/columnas.

La cantidad de elementos por página se calcula a partir del espacio real. Al redimensionar se corrige la página si queda fuera de rango y se mantienen búsqueda y filtros activos.

Cuando la Pokédex y el Album no pueden coexistir correctamente con la misma altura visual, el Album puede utilizar el modo integrado previsto por el diseño, conservando el acceso a los submenús correspondientes.

---

## 19. Pokémon Profile

Se mantuvo la carta `63:88` y sus dos distribuciones internas.

La migración contempla:

- Base capturado;
- Shiny capturado;
- Base no capturado;
- Shiny no capturado;
- cartas con movimientos;
- cartas sin movimientos;
- nombres largos;
- habilidades largas o múltiples;
- movimientos largos;
- Pokémon sin Forms;
- múltiples Forms;
- familias evolutivas ramificadas.

El contenido no modifica la proporción externa de la carta.

---

## 20. Cubierta de variante no capturada

La captura se comprueba por variante.

Cuando la variante activa no está capturada:

- la carta conserva exactamente su tamaño;
- se aplica la cubierta oscura;
- se mantiene la silueta correspondiente;
- se ocultan los datos internos;
- el botón Shiny habitual queda cubierto y deja de ser interactivo;
- controles ocultos no conservan foco;
- la navegación externa sigue disponible.

Para evitar que el usuario quede bloqueado en una variante no capturada, la cubierta incorpora un único control contextual debajo del mensaje `Not captured` cuando la variante contraria sí está capturada:

- `View Base` aparece al visualizar un Shiny no capturado si Base está capturado;
- `View Shiny` aparece al visualizar una Base no capturada si Shiny está capturado;
- si ninguna de las dos variantes está capturada, el control no aparece.

Este botón es accesible por teclado, no descubre los controles internos cubiertos y utiliza la misma actualización de variante del Profile, por lo que mantiene sincronizados carta, carrusel, Journal, Stats, Moves y estado de cubierta. Su incorporación no modifica la relación `63:88` ni la geometría interna de la carta.

Una Shiny no capturada no recibe el tratamiento dorado completo reservado para una Shiny capturada.

---

## 21. Carrusel, Evolution y Forms

Se conserva el carrusel circular y su sincronización con Profile.

La selección del carrusel actualiza de forma coherente:

- carta;
- nombre;
- identificador;
- tipos;
- HP;
- sprite;
- información;
- Journal;
- Stats;
- Moves;
- estado de captura/cubierta.

`Evolution` permanece dentro de la familia evolutiva correspondiente y `Forms` dentro de las variantes de la especie correspondiente. Cuando no existen formas, el control permanece visible pero deshabilitado.

---

## 22. Journal, Stats y Moves

Las tres vistas se conservaron.

### Journal

Mantiene información, diagramas y los indicadores de:

- amistad base;
- tasa de captura;
- distribución de género.

### Stats

Mantiene datos y gráfica sin deformar el área disponible.

### Moves

Conserva todos los movimientos y utiliza scroll cuando el contenido realmente lo necesita.

Los cambios de pestaña no deben vaciar contenido válido de forma innecesaria.

---

## 23. Responsive

La adaptación utiliza ancho y altura reales del escenario.

Se contemplan:

- escritorio amplio;
- laptop/escritorio con poca altura;
- Pokédex + Album;
- panel estrecho dentro de una ventana amplia;
- tablet;
- 390–480 px;
- alrededor de 320 px;
- móvil horizontal;
- redimensionado durante el uso.

La Pokédex no desaparece mediante un breakpoint genérico cuando se usa sola: se escala proporcionalmente usando las dimensiones disponibles.

---

## 24. Accesibilidad

La migración conserva o mejora:

- nombres accesibles;
- navegación por teclado;
- foco visible;
- `aria-expanded`;
- `aria-pressed`;
- `aria-hidden`;
- `disabled`;
- `inert`;
- retorno de foco;
- contenido oculto fuera de interacción;
- `prefers-reduced-motion`.

También se corrigió el caso en el que el botón de Pokémon Album podía conservar el foco mientras su ancestro pasaba a `aria-hidden`/`inert`. Ahora el foco se mueve a una superficie visible antes de ocultar la Pokédex correspondiente.

---

## 25. Animaciones, audio y recursos

Se conservaron:

- apertura/cierre del dispositivo;
- captura;
- transiciones;
- brillo Shiny;
- fondos mediante canvas;
- cry/audio;
- precarga de recursos;
- movimiento reducido.

Los observers, timers y listeners asociados al runtime se gestionan desde el ciclo de vida React y se evita inicializar dos veces el sistema bajo `React.StrictMode`.

---

## 26. React StrictMode

React 18 puede montar/desmontar efectos adicionalmente en desarrollo para detectar problemas.

El proyecto incorpora una protección de inicialización para que el runtime no duplique:

- listeners;
- observers;
- temporizadores;
- controles generados;
- efectos globales.

Esto permite mantener `React.StrictMode` activo sin duplicar interacciones.

---

## 27. Limpieza y optimización

La migración incluyó limpieza conservadora del código existente.

Se eliminaron únicamente elementos cuyo reemplazo podía comprobarse:

- helpers sin uso;
- estados obsoletos;
- rutas CSS muertas;
- placeholder que dejó de formar parte de la cadena final;
- overrides redundantes demostrablemente sustituidos dentro del mismo contexto;
- reglas CSS vacías.

Se eliminaron 107 declaraciones CSS sobrescritas y 12 reglas vacías sin cambiar las declaraciones finales que gobiernan el diseño.

No se intentó reescribir agresivamente todo el runtime porque habría elevado el riesgo de perder comportamiento visual ya aprobado.

---

## 28. Pruebas automáticas

La suite contiene 22 pruebas que cubren los contratos más sensibles:

1. progreso por especie sin inflar formas;
2. filtros Base/Shiny y denominador;
3. metadata incompleta;
4. catálogo local del Album;
5. tarjetas `4:3`;
6. capacidad de filas del Album;
7. referencia `420 × 746`;
8. escalado uniforme por ancho y altura;
9. INFO/STATS según margen disponible;
10. responsive en poca altura/landscape;
11. `View Base` cuando Base está capturado y Shiny no;
12. `View Shiny` cuando Shiny está capturado y Base no;
13. ausencia del control de retorno cuando la variante contraria tampoco está capturada;
14. simetría de la carcasa;
15. Official Artwork → HOME;
16. excepciones de artwork normal;
17. Showdown → Generation V;
18. sprites de búsqueda;
19. independencia Base/Shiny;
20. persistencia del formato heredado;
21. entradas individuales inválidas;
22. preservación de valores legacy no interpretables.

Resultado ejecutado sobre la fuente entregada:

```text
22 tests
22 pass
0 fail
```

---

## 29. Comprobación estructural

El comando:

```bash
npm run check
```

realiza:

- comprobación de sintaxis del runtime;
- comprobación estática del código/JSX;
- validación del contrato de IDs.

Resultado ejecutado sobre la fuente entregada:

```text
Project contract OK: 82 runtime DOM ids resolved, 121 unique ids rendered, 121 original ids preserved.
```

---

## 30. Build y validación en navegador

Durante la verificación de la migración en Windows se ejecutaron correctamente:

```bash
npm install
npm test
npm run check
npm run build
npm run dev
npm run preview
```

La aplicación fue revisada en navegador y se confirmó:

- comportamiento visual equivalente a la versión original;
- navegación general funcional;
- persistencia de capturas después de recargar;
- funcionamiento tanto en desarrollo como en preview de producción;
- ausencia de errores rojos durante la navegación revisada;
- detección y corrección del warning de foco/`aria-hidden` del Album.

En el entorno de empaquetado del repositorio se volvieron a ejecutar sobre la fuente entregada las 22 pruebas y `npm run check`. El workflow de GitHub Pages incluido ejecuta nuevamente instalación, pruebas, comprobación y build antes de publicar.

---

## 31. GitHub Pages

El proyecto incluye:

```text
.github/workflows/deploy-pages.yml
```

El workflow se ejecuta al hacer push a `main` y realiza:

1. checkout;
2. Node 20;
3. `npm ci`;
4. `npm test`;
5. `npm run check`;
6. `npm run build`;
7. publicación de `dist/` en GitHub Pages.

`vite.config.js` utiliza:

```js
base: "./"
```

para que los assets generados funcionen correctamente cuando la aplicación se publica dentro del subdirectorio de un repositorio de GitHub Pages.

Después de crear el repositorio, únicamente debe activarse GitHub Pages con **GitHub Actions** como fuente si GitHub no lo hace automáticamente, y editar en `README.md` la URL real del repositorio publicado.

---

## 32. Comandos del proyecto

### Instalar dependencias

```bash
npm install
```

### Desarrollo

```bash
npm run dev
```

### Pruebas

```bash
npm test
```

### Comprobación

```bash
npm run check
```

### Build de producción

```bash
npm run build
```

### Previsualizar el build

```bash
npm run preview
```

---

## 33. Archivos que no se versionan

`.gitignore` excluye los elementos generados localmente:

- `node_modules/`;
- `dist/`;
- `.vite/`;
- logs;
- archivos `.DS_Store`.

El repositorio contiene únicamente fuente, assets, configuración, pruebas y documentación necesarios para desarrollar, verificar, compilar y desplegar el proyecto.

---

## 34. Recomendaciones de mantenimiento

1. Mantener la compatibilidad de `wikidex-captures` antes de modificar persistencia.
2. Mantener la separación entre especies y formas antes de tocar porcentajes.
3. No sustituir una forma por otra en fallbacks de sprites.
4. Mantener pruebas de geometría antes de modificar carcasa o responsive.
5. Migrar más lógica del runtime a hooks/estado React únicamente de forma incremental.
6. Evitar cambios simultáneos de estructura, CSS y reglas de datos.
7. Mantener el workflow de Pages como verificación previa al despliegue.

---

## 35. Resultado final de la migración

El resultado es una aplicación React/Vite que conserva la identidad y funcionamiento de la Pokédex original, con una estructura preparada para repositorio y despliegue.

Se mantuvieron:

- datos guardados;
- reglas Base/Shiny;
- navegación;
- sprites y fallbacks;
- audio;
- animaciones;
- filtros;
- progreso;
- Profile;
- carrusel;
- Journal, Stats y Moves;
- relaciones de aspecto y geometrías aprobadas.

Al mismo tiempo se incorporaron componentes React, módulos de dominio y servicios, pruebas automáticas, comprobaciones estructurales, accesibilidad corregida, responsive basado en espacio real, limpieza conservadora y despliegue automatizado a GitHub Pages.

La fuente entregada pasa **22/22 pruebas** y conserva el contrato de **82 IDs utilizados por el runtime, 121 IDs únicos y 121 IDs originales preservados**.
