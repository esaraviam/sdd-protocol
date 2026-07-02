# Manual de uso — SDD Flow

Guía de operación del pipeline de **Spec-Driven Development (SDD)**, distribuido como **plugin de Claude Code**: los 4 comandos slash y las 10 skills trabajadoras vienen empaquetados juntos y se cargan automáticamente al instalar el plugin (ver `README.md` para la instalación).

> El flujo convierte una idea en software siguiendo 5 etapas: **especificar → diseñar → descomponer → ejecutar → validar**, con una compuerta de aprobación humana (`[APPROVAL]`) entre fase y fase y un **quality gate GO/NO-GO** obligatorio al cierre.

---

## 1. Mapa rápido

| Paso | Comando | Qué hace | Produce |
|------|---------|----------|---------|
| 1 | `/create-spec <archivo.md>` | Te entrevista y escribe la especificación de negocio | `specs/<archivo>.md` |
| 2 | `/sdd-plan <archivo.md>` | **Planificación** (Fases 0–2) **fijada a Opus** vía frontmatter: arquitectura → backlog; emite el grafo y hace handoff | `documentation/`, `.sdd/tasks/` |
| 3 | `/sdd-execute [archivo.md]` | **Ejecución** (Fase 3 + gate) **fijada a Sonnet**; los workers enrutan por su `model_hint`. También retoma un pipeline interrumpido | código verificado, gate GO/NO-GO |
| 4 | `/sdd-quality-gate [archivo.md]` | Verifica completitud + calidad y emite veredicto **GO / NO-GO** | `.sdd/quality-gate-report.md` |

Skills trabajadoras disponibles (invocadas por `/sdd-execute` y el quality gate):
`software-architect`, `ai-security-expert`, `backend-coder`, `senior-frontend-engineer`, `ux-design-expert`, `qa-engineer`, `webapp-testing`, `refactor-auditor`, `release-manager`, `system-memory`.

---

## 2. Requisitos previos

- Tener el **plugin SDD instalado** (ver `README.md`); los comandos y skills quedan disponibles globalmente en cualquier proyecto.
- Ejecutar los comandos **desde la raíz del proyecto** sobre el que vas a trabajar.
- El proyecto destino tendrá (o se crearán) estas carpetas:
  - `specs/` — especificaciones de negocio.
  - `documentation/api|db|ui/` — contratos modulares de arquitectura.
  - `.sdd/tasks/` — grafo de tareas en JSON.
- Las skills vienen empaquetadas en el plugin y Claude Code las carga automáticamente por nombre.

---

## 3. Paso 1 — Crear la especificación

```
/create-spec checkout-flow.md
```

El comando actúa como analista de negocio y te entrevista **una pregunta a la vez**:

1. **Nombre y objetivo** — propuesta de valor, qué problema resuelve.
2. **Actores / usuarios** — quién interactúa con la funcionalidad.
3. **Requisitos funcionales** — comportamientos no negociables / user stories.
4. **Entidades de datos** (opcional) — modelos, atributos, reglas de negocio.
5. **Criterios de aceptación** — cómo sabemos que está terminado.

Al terminar, escribe `specs/checkout-flow.md` con esta estructura fija:

```
# Spec: [Feature]
## 1. Objective & Value Proposition
## 2. User Personas & Actors
## 3. Functional Requirements & User Stories
## 4. Business Logic & Constraints
## 5. Explicit Acceptance Criteria
- [ ] ...
```

> 💡 Revisa el archivo generado antes de pasar a `/sdd-plan`. Esta es la única etapa pensada para iterar a mano.

---

## 4. Paso 2 — Ejecutar el pipeline (plan → execute)

El pipeline se corre en **dos comandos**, cada uno fija su modelo automáticamente vía frontmatter:

```
/sdd-plan checkout-flow.md       # Fases 0–2, fijado a Opus → emite .sdd/tasks/
/sdd-execute checkout-flow.md    # Fase 3 + quality gate, fijado a Sonnet
```

> El argumento es **el nombre del archivo dentro de `specs/`**, no la ruta completa. En `/sdd-plan` es obligatorio (si lo omites, te pregunta); en `/sdd-execute` es opcional (lo infiere del grafo). 

`/sdd-plan` corre las **Fases 0–2** en un solo turno (las aprobaciones entre fases se piden con `AskUserQuestion`, no con `[APPROVAL]` tecleado, para que el pin de Opus aguante). Cuando aprueba el grafo, te dice que corras `/sdd-execute`, que ejecuta la **Fase 3** y dispara sola la **Fase 4** de quality gate al final.

### Fase 1 — Diseño arquitectónico (`software-architect`)

- Lee `specs/checkout-flow.md`.
- Invoca `software-architect` (prohibido escribir código de aplicación aquí).
- Produce contratos **modulares** (nunca un archivo monolítico):
  - `documentation/api/api_checkout-flow.md` — endpoints, payloads, status codes.
  - `documentation/db/db_checkout-flow.md` — esquemas, tablas, campos, relaciones.
  - `documentation/ui/ui_checkout-flow.md` — jerarquía de componentes, estado, wireframes *(se omite si es backend-only)*.
  - `documentation/conventions.md` — **convenciones transversales que toda tarea debe respetar**: stack/lenguaje, naming, formato de errores/respuestas, patrones de auth y logging, utilidades compartidas y dónde viven, convenciones de test. Es la única verdad compartida que reciben los agentes en frío además de su porción de arquitectura, así que combate la deriva entre tareas paralelas.
- Si hay superficie sensible (auth, PII, pagos) invoca además `ai-security-expert` y registra sus restricciones en el contrato correspondiente.
- Presenta un resumen y **espera tu `[APPROVAL]`**.

---

## 5. Modelos por fase (automático vía el split)

> ✅ **Cómo funciona.** Cada mitad del pipeline fija su modelo sola con el campo `model:` del frontmatter — **no necesitas `/model` manual**. `/sdd-plan` declara `model: opus` y `/sdd-execute` declara `model: sonnet`.
>
> ⚠️ **El detalle clave del frontmatter.** El override de `model:` **dura solo el turno actual** y se descarta en tu siguiente prompt tecleado. Por eso `/sdd-plan` pide sus aprobaciones entre fases con `AskUserQuestion` (mismo turno) en vez de esperar un `[APPROVAL]` tecleado: así Opus sigue activo en las Fases 1 y 2. El routing **más** robusto, independiente del turno, es la **Fase 3 (fan-out)**: `/sdd-execute` pasa el `model_hint` por sub-agente a la Task tool (`opus`/`sonnet`/`haiku`/`fable`); si no lo pasa, el sub-agente hereda el modelo de sesión.

| Fase / Tarea | Modelo | Cómo se aplica | Razón |
| :--- | :--- | :--- | :--- |
| **Génesis de Spec** (`/create-spec`) | `Opus` | `/model` (o `model:` en frontmatter del comando) | Eliminar ambigüedades en la raíz del proyecto. |
| **Arquitectura** (`Fase 1`) | `Opus` | **automático** — `/sdd-plan` (frontmatter `model: opus`) | Razonamiento profundo para contratos y seguridad. |
| **Backlog** (`Fase 2`) | `Opus` | **automático** — `/sdd-plan` (mismo turno Opus) | Precisión para descomponer tareas atómicas, respetando la arquitectura recién diseñada. |
| **Implementación** (`Fase 3`) | `Sonnet`/`Haiku` | **automático** — `/sdd-execute` coordina en Sonnet; cada worker por su `model_hint` ✅ **real** | Estándar para código; Haiku solo para doc/boilerplate. |
| **Quality Gate** (`Fase 4`) | `Opus` | **automático** — `/sdd-quality-gate` declara `model: opus` en su frontmatter (rige el resto del turno aunque lo dispare `/sdd-execute` en Sonnet) | Validación crítica vs Spec y auditoría. |

> 💡 **En la práctica:** corre `/sdd-plan` para diseño + backlog (Opus fijado) y `/sdd-execute` para construir (Sonnet fijado, workers por `model_hint`). El modelo correcto se aplica solo en cada mitad.

**Prompt Caching:** los agentes leen siempre `conventions.md` al inicio de cada tarea. Esto activa el caché de Anthropic, reduciendo el costo de tokens en lecturas repetitivas.

---

## 1.6. Capa de Persistencia y Memoria Sistémica (Aprendizaje Continuo)

A diferencia de los flujos genéricos, SDD mantiene una memoria viva del proyecto para evitar la deriva arquitectónica y la repetición de errores:

1.  **SYSTEM_MAP.md (`documentation/`):** Un índice dinámico de archivos, APIs y modelos existentes. La Fase 1 lo consulta para asegurar que el nuevo diseño sea compatible con lo que ya está construido.
2.  **Retrospectives (`.sdd/retrospectives.json`):** Un registro de por qué fallaron auditorías previas. La Fase 2 inyecta estas "lecciones aprendidas" como criterios de aceptación automáticos en las nuevas tareas.
3.  **Engram — capa de memoria semántica que viaja con el repo (`engram` CLI):** Backend de memoria persistente por proyecto que **convive** con los archivos anteriores (*dual-write*). Los `.md`/`.json` siguen siendo la verdad versionable en git; Engram añade **búsqueda semántica cross-spec**: en vez de releer el `SYSTEM_MAP.md` completo o todo el `retrospectives.json`, las fases recuperan solo lo relevante.
    - **Llave de proyecto (importante):** `engram save` **NO** auto-detecta el proyecto — hay que pasar `--project` explícito, y debe ser el **basename del repo** para que coincida con lo que escribe `engram sync`. Todas las fases lo derivan igual: `PROJ="$(basename "$(git rev-parse --show-toplevel)")"`.
    - **Ciclo que hace viajar la memoria por git:**
      - **Export (cierre):** la skill `system-memory` (Stage 4) hace `engram save … --project "$PROJ"` y luego `engram sync --project "$PROJ"`, que escribe `.engram/manifest.json` + `.engram/chunks/*.jsonl.gz`. `engram sync` **no toca git**; deja `.engram/` en el working tree y tu **commit de release post-GO lo incluye**. `.engram/` debe **commitearse**, nunca ir al `.gitignore`.
      - **Import (apertura):** la **Fase 1** y `/sdd-execute` corren `engram sync --import --project "$PROJ"` para cargar en la DB local los chunks que vinieron en el `git pull`, antes de hacer recall. Así la memoria de un compañero (o de otra máquina) está disponible para tu corrida.
    - **Recall por fase (doble lectura: contenido semántico + cobertura determinista):**
      - **Fase 1** → **(a)** `engram search "<dominio>" --type architecture` trae el *contenido* de decisiones previas; **(b)** un scan de `.sdd/memory-index.jsonl` filtrado por `type` + `domain` enumera *qué debería* considerarse. Toda entrada de (b) ausente de (a) es un **miss** → se lee directo su `source`. El recall semántico deja de ser autoritativo; el índice enumerable es el piso.
      - **Fase 2** → lo mismo con `--type retrospective`: una lección presente en el índice pero que el `engram search` no recuperó se detecta por `id` y se inyecta igual (una `binding:true` es obligatoria, no opcional).
    - **Taxonomía de tipos:** `architecture` (decisiones / endpoints / modelos, tras GO) y `retrospective` (causa raíz + regla a aplicar, tras NO-GO).
    - **Índice determinista — `.sdd/memory-index.jsonl` (append-only, versionado):** el recall semántico es *lossy* — un resultado vacío por una query que no cayó cerca es idéntico a "no existe". Para cerrar ese hueco, cada memoria persistida por `system-memory` **además** anexa una línea `{"id","type","spec","domain","binding","one_line_rule","source","created_at"}` a este índice. Es la fuente de verdad de *qué existe* (Engram/`.md` son la de *contenido completo*); la máquina enumera, el LLM no adivina. **Viaja por git como `.engram/`** (nunca al `.gitignore`), es append-only (no se reordena ni compacta), y es lo que hace viable el **modo degradado** sin miopía: sin engram, el recall completo se sirve desde el índice + lectura directa de archivos.
    - **Constraints vinculantes (`binding:true`) — siempre por enumeración:** las decisiones de seguridad, tenencia/RLS, contrato de API o invariante de datos se marcan `binding:true` en el `engram save` (criterio explícito, nunca inferido). En cada fase que consulta memoria se leen **antes** del recall semántico, enumerando todas las del dominio — nunca se juega una invariante a que la query caiga cerca en el espacio de embeddings. La Fase 2 inyecta cada una como `acceptance_criteria` duro en las tareas cuyo `file_scope` toca su dominio, y el gate (Etapa 0) hace **NO-GO** si alguna queda huérfana (sin tarea que la cubra), documentando el mapeo `constraint → tarea`. Mantén el set pequeño: si todo es binding, nada lo es.
    - **`memory-gate` — recall como precondición falsable de fase:** "usar engram" no descansa en confianza. Cada fase que consume memoria invoca el `memory-gate` (extensión de `system-memory`) que corre el recall dual y emite un marcador `[MEMORY-CONFIRMATION: <fase> | recalled=<n> | binding=<n> | miss=<n> | mode=ACTIVE|DEGRADED]`. **La Fase 1 no arranca el diseño sin un marcador válido de `architecture`; la Fase 2 no genera el grafo sin uno de `retrospective`.** El marcador se valida por `id` contra `.sdd/memory-index.jsonl` (misma falsabilidad que el `[SKILL-CONFIRMATION]` contra el diff): un `recalled=0` sobre un dominio con entradas → la fase corrió ciega → **abort/NO-GO**; el conteo `binding` debe cuadrar con las entradas `binding:true` del dominio. Es obligatorio también en `MEMORY-DEGRADED` (se sirve desde índice + archivos, `mode=DEGRADED`). El resultado se persiste en `.sdd/memory-recall.json` y el gate lo refleja en `Memory-Recall: Phase1=… · Phase2=…`.
    - **Bootstrap (Fase 0 de `/sdd-plan`) — resuelve el modo de memoria explícito:** al inicio, un chequeo programático resuelve un estado discreto y lo persiste en `.sdd/memory-mode` (estado local, va en `.gitignore`):
      - **`MEMORY-ACTIVE`** — `engram` instalado dentro de un repo git. Verifica además que `.engram/` **no esté git-ignored** (con `git check-ignore`) y avisa si hay chunks sin commitear; si está ignorado, ofrece quitar esa línea del `.gitignore`. Idempotente y **silencioso cuando todo está bien**. Nunca commitea.
      - **`MEMORY-DEGRADED`** — `engram` ausente o inutilizable. El pipeline **NO continúa en silencio**: emite un banner `[MEMORY-DEGRADED]` explicando qué recall se pierde (surfacing semántico cross-spec) y qué se conserva (índice determinista + archivos), y pide **confirmación humana explícita** vía `AskUserQuestion` ("continuar degradado" / "abortar e instalar engram"). Sin confirmación, aborta antes de la Fase 1.
    - **Requisitos:** correr siempre desde la **raíz del proyecto**. Engram no es dependencia dura (la miopía se compensa con el índice determinista de archivos), pero el modo degradado es una **decisión consciente y trazable**, no un default invisible: `/sdd-execute` y el gate leen `.sdd/memory-mode`, y el reporte estampa `Memory-Mode: ACTIVE | DEGRADED` (un GO degradado se rotula `GO (memory-degraded)`). Para activar la memoria semántica, instala el plugin `engram` aparte (`/plugin install engram`) y permite `Bash(engram:*)` en tu `settings.json`.
4.  **Quality Gate Feedback Loop:** Tras cada ejecución, el Gate (Stage 4) invoca la skill `system-memory` que hace **dual-write + sync**: destila el éxito en `SYSTEM_MAP.md` + `engram save --type architecture`, o el fallo en `retrospectives.json` + `engram save --type retrospective`, y exporta a `.engram/`. Así la memoria de la corrida queda versionada en git y disponible para el recall semántico de futuras specs en cualquier clon del repo.

---

## 2. Requisitos previos

### Fase 2 — Backlog y grafo de dependencias

- Lee los contratos aprobados.
- Descompone la arquitectura en **tareas atómicas**, una por archivo en `.sdd/tasks/task_01.json`, `task_02.json`, …

Esquema mínimo de cada tarea:

```json
{
  "id": "task_01",
  "spec": "checkout-flow.md",
  "title": "Título imperativo corto",
  "skill": "backend-coder",
  "status": "pending",
  "depends_on": [],
  "read_architecture_section": "documentation/db/db_checkout-flow.md#Auth rules",
  "file_scope": ["src/api/urls/**", "src/db/migrations/003_urls.sql"],
  "acceptance_criteria": ["..."]
}
```

- `depends_on` — IDs que deben estar `completed` antes (p.ej. una tarea de frontend depende del contrato de API).
- `skill` — qué skill ejecuta la tarea.
- `read_architecture_section` — **archivo + heading exactos**; el ejecutor lee solo esa porción, no toda la arquitectura (ahorra contexto).
- `file_scope` — archivos/globs que la tarea puede crear o modificar. Dos tareas corren **en paralelo solo si sus `file_scope` son disjuntos**; esto es lo que permite el fan-out de agentes en la Fase 3. Si dos tareas deben tocar el mismo archivo, dale a una un `depends_on` de la otra en vez de paralelizarlas.

**Pre-flight de hubs — sellar la miopía intra-spec.** Engram cierra la ceguera *cross-spec*, pero dos workers de la *misma* corrida no se ven entre sí. Tras generar el backlog, la Fase 2 cuenta cuántas tareas incluyen cada path/glob en su `file_scope`: **todo path en el `file_scope` de más de una tarea es un `hub`** (tipos compartidos, un barrel/`index`, config, un **puerto/adaptador** hexagonal, o un **registry central de SDUI**). Ahí es donde dos agentes aislados producen contratos incompatibles que nadie ve hasta la integración. Cada hub **debe** recibir una estrategia antes del `[APPROVAL]`:
- **(A) Interfaz congelada** — una tarea de contrato (`software-architect`) fija primero la forma del hub (firmas/tipos exportados, forma del registry) como artefacto en `documentation/`; las consumidoras `depends_on` esa tarea y su `file_scope` sobre el hub se restringe a **añadir entradas conformes, no redefinir la forma** (se inyecta un criterio duro de conformidad). Si congelar exige más que un contrato mínimo, el hub quedó subespecificado en la Fase 1 → route-back a Fase 1.
- **(B) Serialización** — las tareas del hub se encadenan con `depends_on` y **nunca caen en la misma ola**.

El mapa se persiste en `.sdd/hubs.json` (viaja con el grafo, como `tasks/`) para que el compositor de olas de la Fase 3 lo lea sin re-derivarlo. Solo los hubs **reales** (solapamiento comprobado) disparan resolución; el resto sigue en fan-out libre.

Presenta el grafo completo (IDs, skill, dependencias) **y la lista de hubs detectados con su estrategia (A/B) y su tarea/doc de contrato**, y **espera tu `[APPROVAL]`** — un hub sin estrategia bloquea la aprobación.

### Fase 3 — Ejecución paralela por fan-out de agentes

Aquí `/sdd-execute` deja de implementar y actúa como **coordinador**: no escribe código ni lee la arquitectura, solo despacha cada tarea a un **subagente aislado** (Task tool, `general-purpose`, en background) que corre en su propio contexto y devuelve un resumen. Esto mantiene el contexto del orquestador liviano toda la corrida — **ya no necesitas `/compact` manual entre tareas**.

Trabaja en **olas (waves)**:

1. **Escanear y resolver.** Carga todas las tareas; una `pending` se *desbloquea* cuando todos sus `depends_on` están `completed`.
2. **Armar la ola (sin colisiones, hubs incluidos).** Del conjunto desbloqueado, selecciona un lote cuyos `file_scope` sean **disjuntos entre sí**. Dos tareas que comparten un archivo van en olas distintas. **La disjunción se evalúa incluyendo los hubs de `.sdd/hubs.json`**: ninguna ola admite dos tareas que compartan un hub, aunque el resto de su `file_scope` sea disjunto — dos workers aislados sobre el mismo hub producen contratos incompatibles. Con hubs de estrategia (A) esto ya lo garantizan sus `depends_on` a la tarea de contrato congelado; con (B), la cadena de serialización.
3. **Reclamar (lock atómico).** Antes de despachar, reclama cada tarea creando un lockfile atómico `mkdir .sdd/locks/<task_id>.lock` (con `{pid, host, terminal_id, claimed_at}` dentro). `mkdir` es atómico: si ya existe, otra terminal ganó la tarea y la saltas; **solo tras ganar el lock** marcas `in_progress` en el JSON. El JSON es estado observable, no el mecanismo de exclusión (marcarlo directo es un read-then-write no atómico con race entre terminales). `.sdd/locks/` es estado local y va en `.gitignore`.
4. **Fan-out en background.** Lanza un subagente por tarea, **en paralelo**. Cada agente recibe un payload mínimo: `id`/`title`/`acceptance_criteria`/`file_scope`; la instrucción de **invocar la skill de `"skill"` y demostrarlo** en su reporte con el marcador `[SKILL-CONFIRMATION]` **y** el bloque estructural `[ARTIFACT: <skill> | schema=<name> vN]` que define su `SKILL.md` (la experticia vive en la skill: hacer el trabajo de forma genérica —o emitir el marcador sin el artefacto— es una falla, no un atajo); de leer **primero** `documentation/conventions.md` y luego **solo** su `read_architecture_section`. **Frontera dura:** si necesita tocar un archivo fuera de su `file_scope`, debe **ABORTAR y reportarlo**, nunca editarlo. El agente devuelve un **reporte estructurado**: prueba de skill (`skill_invoked` + marcador específico), archivos modificados, cada criterio cumplido sí/no, y el comando de test/lint si aplica.
5. **Esperar y reconciliar (verificar, no confiar).** Un "listo" auto-reportado no basta. Marca `completed` **solo si pasan todas**:
   - (a) **Prueba de skill falsable — estructural, no solo autoría de archivos.** El marcador `[SKILL-CONFIRMATION: <skill> | … ]` debe existir tal cual lo define ese `SKILL.md`, y se valida en orden: **(a.1) presencia + nombre** — existe y `<skill>` coincide con el `"skill"` de la tarea; **(a.2) anchor contra el diff** — todo path que el marcador nombra (`Components`, `Delivered Files`, `Files Reviewed`, `Files Audited`, `Implemented Files`) debe aparecer en el `git diff` de la tarea; **(a.3) artefacto estructural** — cada skill emite además un bloque `[ARTIFACT: <skill> | schema=<name> vN]` con una *forma que solo esa skill produce* (threat-model `surface×mitigation`, métricas `refactor-metrics` sobre archivos del diff, matriz `qa-traceability` criterio×test, `semver-derivation`, `memory-index-delta`, …), y el anchor valida **la forma + que cada referencia resuelva contra evidencia real**: refs a archivo → en el diff; refs a superficie de contrato → endpoint/campo real en `documentation/api|db|ui/…`; refs a test → test que existe y corrió con exit 0; refs a línea de índice → `id` en `.sdd/memory-index.jsonl`; refs a artefacto en disco → `stat` OK. Los conteos/veredictos del marcador (`BLOCKING`, `Files Audited`, `Flows Tested`, `Index`, `SemVer Bump`) deben cuadrar con las filas del artefacto; **(a.4) consistencia de veredicto** — si el marcador trae `Verdict`/`Health Score`/`Safe to Merge`/`BLOCKING`, no debe contradecir los checks (d)/(e). Un marcador que falla cualquiera de estos, **o un artefacto bien formado pero genérico cuyas referencias no resuelven**, se trata como **prueba inexistente** — reject. Esto es el núcleo del rediseño: **anclar la *forma* a evidencia determinista sube el costo de falsificar una skill de trivial a caro** — la autoría de archivos ya no basta para certificar que se aplicó la metodología de la skill.
   - (b) `git diff --name-only` (más untracked) muestra que **todo** path tocado cae dentro del `file_scope`.
   - (c) los archivos declarados existen en el diff.
   - (d) el comando de test/lint, si lo hay, sale con código 0.
   - (e) los `acceptance_criteria` se cumplen objetivamente en el diff.

   Si algo falla → vuelve a `pending` y registra el motivo en el JSON. En ambos casos (completada o revertida) **libera el lock borrando** `.sdd/locks/<task_id>.lock` — ninguna tarea debe quedar con lock colgado.
6. **Loop.** Re-resuelve dependencias (tareas completadas desbloquean otras) y despacha la siguiente ola. Sin purga: el contexto de cada worker murió con su agente.

### Fase 4 — Quality Gate obligatorio (auto-invocado)

Cuando no quedan tareas `pending`, el pipeline **todavía no está terminado**. `/sdd-execute` invoca automáticamente `/sdd-quality-gate` (ver Paso 4). El feature solo se considera completo cuando el gate devuelve **GO**.

- Si devuelve **NO-GO**, te indica la tarea/skill exacta a corregir (normalmente vía `/sdd-execute`) y vuelves a correr el gate.
- El gate **nunca muta git**; tras un GO, tú ejecutas el release real.

---

## 5. Paso 3 — Retomar tras una interrupción

Si cerraste la sesión, hiciste `/clear`, o cambiaste de terminal a mitad de la Fase 3:

```
/sdd-execute
```

- Reconstruye el estado escaneando `.sdd/tasks/*.json`.
- Detecta el spec activo y localiza sus contratos en `documentation/api|db|ui/`.
- Imprime una **matriz de estado**: completadas / en progreso (locked) / pendientes, resaltando las **tareas desbloqueadas**.
- Arma una **ola sin colisiones** (`file_scope` disjuntos), pide `[APPROVAL]`, y despacha cada tarea a un subagente aislado en background — igual que la Fase 3.

> No necesita argumentos: el estado vive completo en `.sdd/tasks/`.

---

## 6. Paralelismo: cómo se ejecuta de verdad

**Modelo primario — fan-out de agentes en una sola sesión.** En la Fase 3, `/sdd-execute` coordina y lanza un subagente por tarea desbloqueada con `file_scope` disjunto, todos en background a la vez:

```
/sdd-execute checkout-flow.md
   └─ Fase 3 (coordinador)
        ├─ agente → task_02 (backend-coder)   ┐
        ├─ agente → task_03 (frontend)        ├─ en paralelo, contextos aislados
        └─ agente → task_04 (ux)              ┘
        ▼ espera, reconcilia, re-resuelve dependencias → siguiente ola
```

Ventajas frente al esquema viejo de terminales:
- **Contexto del orquestador liviano:** no acumula el trabajo de los workers → sin `/compact` manual.
- **Aislamiento real:** cada tarea muere con su agente; no hay fugas de contexto entre tareas.
- **Colisiones imposibles:** la ola exige `file_scope` disjuntos **incluyendo los hubs** (`.sdd/hubs.json`) — ni siquiera un archivo compartido por dos tareas cae en la misma ola.

**Modelo secundario (opcional) — multi-terminal.** El lock **atómico** (`mkdir .sdd/locks/<task_id>.lock`) hace seguro abrir terminales extra con `/sdd-execute` para más concurrencia que la de una sesión: dos terminales que corren por la misma tarea no pueden ganar ambas el `mkdir`, así que la doble-toma es imposible (sin race TOCTOU). Un lock colgado (p. ej. una terminal murió sin reconciliar) se detecta en el escaneo como candidato a limpieza por su `claimed_at` antiguo y se borra **a mano** (`rm -rf .sdd/locks/<task_id>.lock`) — nunca automáticamente, para no matar una tarea viva de otra terminal.

---

## 7. Estructura de carpetas resultante

```
proyecto/
├── specs/
│   └── checkout-flow.md              # Paso 1
├── documentation/
│   ├── api/api_checkout-flow.md      # Fase 1
│   ├── db/db_checkout-flow.md
│   ├── ui/ui_checkout-flow.md
│   └── conventions.md               # Fase 1 — convenciones transversales (lectura obligatoria de cada agente)
├── .sdd/
│   ├── tasks/
│   │   ├── task_01.json              # Fase 2
│   │   ├── task_02.json
│   │   └── ...
│   ├── hubs.json                     # Fase 2 — mapa de archivos hub + estrategia (A/B)
│   └── quality-gate-report.md        # Fase 4 (veredicto GO/NO-GO)
└── src/ ...                          # Fase 3 (código entregado)
```

---

## 8. Paso 4 — Quality Gate (`/sdd-quality-gate`)

El gate es la **compuerta de cierre obligatoria** del pipeline. Se ejecuta solo (lo invoca `/sdd-execute` al terminar la Fase 3) o lo corres a mano:

```
/sdd-quality-gate                 # infiere el spec desde .sdd/tasks/
/sdd-quality-gate checkout-flow.md
```

Emite un único veredicto vinculante: **GO** o **NO-GO**. El pipeline solo está "terminado" con un GO.

**Etapas internas:**

| Etapa | Qué valida | Bloquea si… |
|-------|------------|-------------|
| **0. Completitud** *(programática)* | Todas las tareas `completed`, contratos presentes, `acceptance_criteria` y `read_architecture_section` válidos | Hay tareas sin terminar o locks colgados → **NO-GO** sin correr las skills |
| **1. QA** (`qa-engineer` + `webapp-testing`) | Cumplimiento del spec, regresiones, flujos UI. El gate **re-corre los tests por su cuenta** y, en specs con UI, intenta levantar el server (`with_server.py`) en vez de saltarse la validación | Veredicto **REJECTED** (o tests en rojo) → NO-GO. UI saltada en silencio sobre un spec con UI → APPROVED-WITH-WARNINGS / NO-GO |
| **2. Arquitectura** (`refactor-auditor`) | Salud arquitectónica, deuda técnica | Cualquier issue **BLOCKING** → NO-GO |
| **3. Release** (`release-manager`, *solo análisis*) | Bump SemVer, changelog, estrategia de merge | Reporta "no safe" si QA rechazó |

**Garantías clave:**

- La Etapa 0 es prerrequisito duro: **no se corren las skills de calidad sobre un pipeline incompleto**.
- **El gate verifica, no confía** — la misma falsabilidad de la Fase 3, aplicada a las skills del propio gate. Cada Etapa 1–3 debe traer su `[SKILL-CONFIRMATION]` anclado al diff **y su artefacto estructural** `[ARTIFACT: <skill> | schema=<name> vN]` cuyas referencias resuelven contra evidencia real (superficie de contrato, archivo del diff, test que corrió, línea de índice, artefacto en disco); la Etapa 0 añade además un *floor* programático de presencia+esquema por tarea. El gate re-deriva el veredicto de QA de su **propia** corrida de tests, y un veredicto auto-reportado que contradice la evidencia (tests en rojo, archivos ausentes del diff, artefacto genérico sin refs que resuelvan, `Safe to Merge` incoherente con QA) se descarta y fuerza **NO-GO**.
- **La validación de UI no se salta en silencio:** en specs con superficie de UI el gate intenta levantar el server; un `SKIPPED` ahí degrada a APPROVED-WITH-WARNINGS o NO-GO. `SKIPPED` limpio solo cuando el spec no tiene UI.
- El gate **nunca crea commits ni tags** — produce un *plan* de release. Tú ejecutas el release real tras el GO.
- Cada item bloqueante viene con su **route-back** explícito (qué tarea/skill corregir).
- El reporte completo queda en `.sdd/quality-gate-report.md`. Hay un ejemplo real en [`examples/coupon-redemption/.sdd/quality-gate-report.md`](../examples/coupon-redemption/.sdd/quality-gate-report.md) (corrida ejecutable: `cd examples/coupon-redemption && node --test`).

---

## 9. Errores y trampas comunes

| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| `/sdd-plan` pregunta qué archivo procesar | Invocaste sin argumento | `/sdd-plan <archivo.md>` con el nombre dentro de `specs/` |
| No encuentra el spec | Lo corriste fuera de la raíz del proyecto | `cd` a la raíz y vuelve a ejecutar |
| Una tarea nunca se desbloquea | Dependencia mal puesta en `depends_on` o una tarea quedó `in_progress` colgada | Revisa/edita el JSON en `.sdd/tasks/`; borra el lockfile colgado (`rm -rf .sdd/locks/<task_id>.lock`) |
| El arquitecto intenta escribir código | — | Es comportamiento prohibido por diseño; reitera que la Fase 1 es solo contratos |
| Dos tareas pisan el mismo archivo | `file_scope` solapados puestos en la misma ola | Ajusta los `file_scope` para que sean disjuntos, o añade un `depends_on` entre ellas para serializarlas |
| Varias tareas deben tocar un archivo compartido (tipos, barrel, config, puerto hexagonal, registry SDUI) | Es un **hub** intra-spec: workers aislados producirían contratos incompatibles | La Fase 2 lo detecta (path en `file_scope` de >1 tarea) y exige estrategia en `.sdd/hubs.json`: (A) congelar su interfaz en una tarea de contrato de la que dependan las consumidoras, o (B) serializarlas; nunca comparten ola |
| Una tarea quedó colgada en `in_progress` | El agente falló sin reconciliar | Vuelve a poner `pending` y borra su lockfile (`rm -rf .sdd/locks/<task_id>.lock`); `/sdd-execute` la re-despachará |

---

## 10. Reglas de oro

1. **Un spec, un pipeline.** No mezcles features en el mismo `.sdd/tasks/`.
2. **Respeta los `[APPROVAL]`.** Son la oportunidad de corregir antes de que el costo suba.
3. **Lee solo la porción que necesitas.** El `read_architecture_section` existe para ahorrar contexto; no leas toda la arquitectura.
4. **`file_scope` disjuntos = paralelismo seguro.** Es lo que permite el fan-out de agentes; si dos tareas comparten archivos, serialízalas con `depends_on`. Un archivo que varias tareas deben tocar es un **hub**: la Fase 2 lo detecta y lo resuelve (interfaz congelada o serialización) antes del fan-out — ningún hub llega sin estrategia ni comparte ola.
5. **Verificar, no confiar.** Una tarea pasa a `completed` solo cuando la reconciliación lo prueba objetivamente — marcador de skill **anclado al diff** (los archivos que nombra existen en el `git diff` y su veredicto no contradice los tests), diff dentro del `file_scope` y tests en verde — no cuando el agente lo afirma.
6. **No declares el feature terminado sin un GO** de `/sdd-quality-gate`. El pipeline solo cierra con veredicto GO.
