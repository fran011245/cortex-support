# Settings UI/UX Suprema — Plan de Sesión

**Estado:** Sesión en curso — Fase 1 accepted ("supreme!") + Fase 2 core + **UI Harmony & Desktop Experience pass** (ver abajo)  
**Fecha de creación:** 2026  
**Inicio de sesión:** 2026 (agente Grok)  
**Propósito:** Servir como documento guía y referencia cuando se inicie formalmente la nueva sesión enfocada en elevar la UI/UX de Settings a nivel "suprema". 

**Notas de inicio de sesión:**
- Auditoría inicial completada vía lectura de código (SettingsModal.tsx, settings.ts, useAgentStore.ts, prompts.ts, modelGuide.ts + theme/UI components).
- Visión y criterios de éxito del plan se mantienen como norte.
- Se arranca directamente con Fase 1 (máximo impacto) tras Fase 0 ligera (no mini-sesión de alineación separada; gaps confirmados coinciden con lo documentado).
- Tracking: todo list activo + actualizaciones incrementales aquí + posibles SESSION_*.md por fase.
- Principios rectores activos: Mac-native, proteger live-apply (setAndPersist), transparencia, claridad > features, progressive disclosure, deleite calmado.

### Fase 1 — Progreso (implementado inicial)
- Análisis: confirmado gaps (input+chips pequeños + load separado + guía en diálogo aparte; sin estados integrados; densidad baja en selector).
- Usuario: "supreme!" — dirección de Fase 1 aceptada.
- Dirección tomada: tarjetas glass premium verticales (una por modelo recomendado) con:
  - Nombre + quant + RAM hint + bestFor + speed/quality.
  - Click en tarjeta = seleccionar (live via setAndPersist, actualiza custom input también).
  - Botón "Load / Download" o "Select & Load" integrado en la tarjeta (primary cuando es la seleccionada).
  - Progreso de descarga/carga integrado dentro de la tarjeta activa (barra + % + label "downloading / loading").
  - Badges claros: "Selected" (cuando default coincide) + "Loaded" (después de éxito del load en esta sesión del modal, con nombre del modelo).
  - Sección "Custom model" elegante debajo (input + Load propio).
  - Enlace a guía full contextualizado.
  - Advanced debug conservado para power users.
- Cambios clave: SettingsModal.tsx (nuevo loadModel helper centralizado, estados loadingTarget/lastLoadedSpec, reemplazo completo del bloque de selección por cards con glass + cn + transiciones sutiles scale/hover).
- Verificación: `pnpm exec tsc --noEmit` limpio (0 errors).
- Fase 1 accepted por el usuario ("supreme!").
- Decisión de grilla: modelos recomendados pasaron de stack vertical a `grid grid-cols-2 gap-3` (3 cards por ahora). Preparado para 4 modelos en 2x2 perfecto. Se ajustó padding interno de cards (p-2.5) y espaciado de texto para que se vea equilibrado en columnas más angostas.
- Sigue protegiendo 100% el live-apply y el resto de settings.

### Fase 2 — Progreso (Prompt Transparency)
- El "Live Effective Prompt Preview" ya no está enterrado: ahora es el **hero** del tab "Agent Prompt", presentado como un hermoso glass card prominente.
- Cambios:
  - Cálculo una sola vez por render (`effectivePrompt`) + helper `estimateTokens()` en prompts.ts.
  - Header claro con ícono, título "Live Effective Prompt" + pulsing live dot.
  - Mensaje fuerte: "Exactly what the model will receive on the next generation".
  - Stats visibles: ≈ tokens + chars.
  - Acción principal: botón **Copy** (copy-to-clipboard del prompt efectivo completo).
  - Explicación excelente abajo: menciona tone + extra + "+ RAG context (when enabled)".
  - Indicador "Live • updates as you edit anywhere in Settings".
  - El editor del "Base System Prompt" ahora es supporting (más compacto, 160px) con nota que explica que tone/extra se mergean arriba.
- Resultado: el usuario siempre ve (y puede copiar) exactamente qué prompt compuesto está usando el agente, sin tener que buscar en una pestaña secundaria.
- Verificación: tsc limpio.
- Próximo en Fase 2: considerar teaser del effective prompt también en la tab General (para que model + prompt sean visibles sin cambiar de tab), o mejorar edición unificada de tone/extra desde el composer.

### UI Harmony & Desktop Experience (transversal, previo a continuar fases)
Usuario pidió revisar que el dialog de Settings esté bien armónico en desktop para mejor experiencia general.

Mejoras aplicadas (en SettingsModal.tsx + ambos dialogs):
- `DialogContent`: agregado `max-h-[85vh] flex flex-col` en los dos diálogos (main Settings + Guía de Modelos). Esto contiene el alto en desktop y previene que el modal crezca más allá de la pantalla.
- Contenido de tabs: agregado `overflow-y-auto` a los 4 `<TabsContent>` para que secciones altas (tarjetas de modelo, preview grande del prompt efectivo, etc.) hagan scroll interno mientras header, tabs y footer permanecen accesibles.
- Footer: armonizado. Se eliminó el `bg-card/60` (que lo hacía sentir como un bloque separado/"afterthought"). Ahora usa `bg-background/60` limpio y consistente en el footer principal y en el footer de la guía de modelos. Más respiración y menos peso visual.
- Estructura general: respeta los `px-6` consistentes, breathing de los nuevos heroes de Fase 1/2, y el ritmo de los tabs.
- Esto ataca directamente gaps del plan original: "Falta respiración y ritmo consistente", "Footer y acciones globales se siente un poco como un afterthought", densidad visual mixta.

Resultado: el dialog ahora se siente más premium, calmado y usable en desktop/Mac, con los upgrades de modelo y prompt integrados de forma natural sin romper el resto de la experiencia.

Verificación: tsc clean. Cambios minimales y seguros.

---

## Visión

Convertir el modal de **CS Settings** en un **centro de control premium, calmado y delicioso** para un co-pilot profesional 100% local en Mac.

No queremos un formulario más. Queremos que el usuario sienta:

- **Claridad total**: Sabe exactamente qué impacto tiene cada cambio en el comportamiento del agente.
- **Control instantáneo y confiable**: Los cambios se sienten vivos, seguros e inmediatos (aprovechando y potenciando el live-apply actual).
- **Deleite sin ruido**: Experiencia Mac-native, con excelente ritmo visual, glassmorphism, tipografía y micro-interacciones de alto nivel.
- **Respeto al usuario**: Tanto principiantes como power users se sienten cómodos y en control.
- **Transparencia del agente**: Especialmente alrededor del prompt efectivo y la elección de modelo.

El resultado ideal es que abrir Settings se sienta como una experiencia **premium y placentera**, no como una tarea administrativa.

---

## Criterios de Éxito

Al finalizar la sesión queremos poder decir que:

- La selección de modelo es una de las experiencias más bonitas y útiles de toda la aplicación (tarjetas informativas, estado claro, carga integrada, conexión natural con la guía de modelos).
- El **Live Effective Prompt Preview** es un ciudadano de primera clase y está altamente visible y accionable.
- Los cambios se sienten **instantáneos y seguros** con feedback calmado pero constante (inline + micro-interacciones).
- La interfaz respira, tiene excelente jerarquía visual y ritmo (no se siente densa).
- Las secciones de Tone Rules y Knowledge Base se sienten premium y confiables.
- Existe coherencia visual y de interacción con el resto de la app, pero Settings se percibe un escalón más arriba en pulido.
- Usuarios nuevos entienden rápido qué hacer; usuarios avanzados descubren poder sin sentirse abrumados.
- Se mantiene (y se potencia) la filosofía de **live apply** que ya existe.

---

## Estado Actual (Post Merge #3)

El estado actual ya tiene una base sólida gracias al trabajo reciente de "premium Settings polish" + mejoras con Claude:

**Fortalezas actuales:**
- Excelente sistema de **live apply** (`setAndPersist`).
- Live Effective Prompt Preview (muy potente, aunque enterrado).
- Guía de Modelos in-app optimizada para Mac (buena).
- Chips de modelos recomendados con hints de RAM.
- Flujo de RAG + Rebuild con feedback.
- Tone rules como switches + preset selector + extra instructions.
- Export/Import/Reset.
- Toggle de "Show usage stats in chat".
- Buen uso de componentes existentes (Dialog, Tabs, Slider, Switch, etc.).

**Oportunidades / Gaps para llegar a "suprema":**

- **Modelos**: Sigue siendo el punto más débil. Input + chips pequeños + botón Load separado + diálogo de guía aparte. No transmite premium ni hace fácil elegir con confianza.
- **Prompt Preview**: Demasiado escondido en una pestaña. Es una de las features más poderosas y está infraexpuesta.
- **Densidad visual**: Mezcla de secciones con tarjetas bonitas y otras más planas. Falta respiración y ritmo consistente.
- **Feedback**: Muy dependiente de toasts. Falta señalización inline más calmada y constante de que "el cambio ya está vivo".
- **Tone Rules**: Funcional pero se siente como una lista de configuraciones avanzadas en vez de un "tone composer" placentero.
- **Knowledge Base**: Correcta, pero no transmite robustez ni confianza premium.
- **Jerarquía y "centro de control"**: Falta que las decisiones más importantes (modelo + prompt) se sientan como lo más importante visualmente.
- **Micro-interacciones y delight**: Buen nivel actual, pero todavía hay espacio para elevarlo (hover states, transiciones sutiles, estados de éxito más bonitos, etc.).
- **Footer y acciones globales**: Se siente un poco como un afterthought.

---

## Principios Rectores (durante toda la sesión)

- **Mac-native primero**: Ritmo, espaciado, iconografía, glass, reveal in Finder, atajos, sensación de herramienta nativa.
- **Proteger y potenciar el live apply**: Es una de las mejores decisiones actuales. No lo sacrifiquemos.
- **Transparencia del agente**: El usuario siempre debe poder entender "qué va a ver el modelo".
- **Claridad > Features**: Preferimos que algo sea obvio y hermoso a que tenga 5 toggles más.
- **Progressive disclosure**: Simple para la mayoría, poderoso y accesible para quien lo necesite.
- **Deleite calmado**: Glass, buenas animaciones sutiles, buen uso de color y tipografía. Nada de "juguetero".
- **Iteración con revisión**: Proponemos → revisamos → implementamos en pasos pequeños.
- **Coherencia con el resto de la app**: Settings debe sentirse parte del mismo sistema de diseño, pero con más pulido.

---

## Plan por Fases

### Fase 0 — Kickoff de Sesión (Visión + Criterios + Auditoría)
- Refinar y alinear la visión y criterios de éxito.
- Auditoría profunda del estado actual (ya realizada en gran parte).
- Decidir orden de fases y scope de la sesión.
- Establecer cómo vamos a trabajar (ritmo de propuestas, revisiones, commits, etc.).

**Entregable:** Este mismo documento actualizado + lista de tareas priorizada.

### Fase 1 — Model Selection Experience (Máximo impacto)
Rediseño completo de cómo se elige y entiende el modelo.

Posibles direcciones:
- Tarjetas premium para los modelos recomendados (integrando datos de la guía de Mac: RAM, performance, best for, speed vs quality).
- Estado claro y visible (Loaded / Not loaded / Downloading + progreso integrado en la tarjeta).
- Botón de "Load / Download" dentro de la tarjeta o muy cercano.
- Mejor conexión con la "Guía de modelos (Mac)" (quizá "Learn more" que expande o abre en contexto).
- Manejo elegante de modelos custom (input avanzado).
- Indicador del modelo actualmente cargado / en uso.

**Meta:** Elegir modelo debe sentirse como una de las experiencias más bonitas y útiles de toda la aplicación.

### Fase 2 — Prompt Transparency & Control
Elevar el Live Effective Prompt Preview.

Posibles direcciones:
- Hacerlo más visible y accionable (quizá un panel lateral, un preview persistente, o un botón "Ver prompt efectivo" muy prominente).
- Mejor comunicación de "esto es exactamente lo que se enviará al modelo (sin RAG)".
- Posible integración con tokens aproximados o estimación de longitud.
- Mejor UX para editar system prompt + tone + extra instructions de forma unificada.

**Meta:** El usuario siempre sabe (y puede ver fácilmente) qué prompt efectivo está usando el agente.

### Fase 3 — Tone & Personality Composer
Transformar la sección actual de Tone Rules.

Posibles direcciones:
- Pasar de una grilla de switches a un "tone composer" más visual y scannable.
- Mejor visualización del preset activo + overrides.
- Preview de cómo suenan las reglas (quizá ejemplos cortos de respuesta).
- Mejor integración con Extra Instructions.

**Meta:** Configurar el tono se siente como diseñar la personalidad del agente, no como marcar checkboxes.

### Fase 4 — Knowledge Base & Trust
Elevar la sección de KB.

Posibles direcciones:
- Mejor visualización del estado del índice (última indexación, cantidad de documentos, salud).
- Acciones más prominentes y bonitas (Choose folder, Rebuild, Reveal).
- Indicadores de "RAG está activo y funcionando" cuando corresponde.
- Mensajes de error / estados vacíos más claros y accionables.

**Meta:** El usuario confía en que su knowledge base está bajo control y actualizada.

### Fase 5 — Global Polish, Feedback System & Delight
Pulido transversal.

Posibles direcciones:
- Sistema de feedback más rico (inline "Applied", "Will affect next generation", sutiles indicadores de live).
- Micro-interacciones y animaciones de calidad (hover, focus, success states).
- Jerarquía visual, espaciado, uso de glass y tarjetas consistente y más lujoso.
- Limpieza y mejora del footer (Reset, Export, Import, Close, Done).
- Mejores empty states, loading states y estados de error.
- Consistencia tipográfica y de iconografía.
- Pequeños detalles de delight (especialmente en Mac).

### Fase 6 — Validación, Accesibilidad y Toques Finales
- Pruebas de flujo reales (usuario nuevo vs power user).
- Keyboard navigation y accesibilidad.
- Consistencia con el resto de la aplicación (chat, sidebar, model status, etc.).
- Ajustes finales de pulido.
- Documentación ligera si corresponde (qué cambió y por qué).

---

## Cómo vamos a trabajar en la sesión

- **Sesión enfocada**: Una vez iniciada, nos enfocamos casi exclusivamente en este objetivo hasta que consideremos que llegamos a un nivel supremo (o hasta que decidamos parar).
- **Iteración en propuestas**: Para cada fase grande, primero hacemos análisis + propuesta de dirección (con mocks o descripciones de UI), revisamos, y luego implementamos en pasos pequeños.
- **Proteger lo bueno**: Nunca rompemos el live-apply ni la transparencia actual sin una razón muy fuerte.
- **Calidad sobre velocidad**: Preferimos hacer menos cosas pero que queden realmente bien.
- **Referencia**: Este documento será la fuente de verdad durante la sesión.

---

## Referencias útiles (al momento de crear este documento)

- Commit mergeado: `6afdb74` — "feat(ui): Settings premium polish + conversation navigation and macOS titlebar fixes (#3)"
- Incluye el trabajo previo de "premium Settings polish" + guía de modelos + usage stats + fix del sidebar (ScrollArea → overflow-x-hidden).
- Archivos principales:
  - `src/components/SettingsModal.tsx`
  - `src/lib/settings.ts`
  - `src/stores/useAgentStore.ts` (parte de settings)
  - `src/lib/prompts.ts` (buildSystemPrompt)
  - `src/lib/modelGuide.ts`

---

## Cómo iniciar la sesión (cuando estés listo)

1. Referenciar este documento.
2. Decidir si queremos hacer una mini Fase 0 de alineación (visión + criterios) o arrancar directamente por Fase 1.
3. Actualizar este archivo con el estado de la sesión (qué fase estamos, decisiones tomadas, etc.).
4. Usar lista de tareas (todo) para trackear el progreso de la sesión.

---

**Listo.** Cuando quieras iniciar la sesión nueva, referenciás este archivo y arrancamos. 

¿Querés que agregue, quite o modifique algo en este documento antes de guardarlo como referencia oficial?