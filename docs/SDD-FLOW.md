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
| **Quality Gate** (`Fase 4`) | `Opus`/`Sonnet` | la corre `/sdd-execute`; las tareas de auditoría se pueden marcar `model_hint: opus` | Validación crítica vs Spec y auditoría. |

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
    - **Recall por fase:**
      - **Fase 1** → `engram search "<dominio>" --type architecture --project "$PROJ"` para traer decisiones de diseño previas que no debe contradecir.
      - **Fase 2** → `engram search "<dominio>" --type retrospective --project "$PROJ"` para inyectar lecciones de *cualquier* spec previo del proyecto, no solo del actual.
    - **Taxonomía de tipos:** `architecture` (decisiones / endpoints / modelos, tras GO) y `retrospective` (causa raíz + regla a aplicar, tras NO-GO).
    - **Bootstrap (Fase 0 de `/sdd-plan`):** al inicio del pipeline, un chequeo programático verifica que `.engram/` **no esté git-ignored** (con `git check-ignore`) y avisa si hay chunks sin commitear (`git add .engram/`). Si está ignorado, ofrece quitar esa línea del `.gitignore`. Es idempotente, silencioso cuando todo está bien, y se omite si `engram` no está instalado. Nunca commitea — solo verifica.
    - **Requisitos:** correr siempre desde la **raíz del proyecto**. Engram es **opcional**: si el binario `engram` no está instalado, las fases **omiten bootstrap/recall/sync en silencio** y operan solo con los archivos — el pipeline nunca falla por su ausencia. Para activar la memoria semántica, instala el plugin `engram` aparte (`/plugin install engram`) y permite `Bash(engram:*)` en tu `settings.json`.
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

Presenta el grafo completo (IDs, skill, dependencias) y **espera tu `[APPROVAL]`**.

### Fase 3 — Ejecución paralela por fan-out de agentes

Aquí `/sdd-execute` deja de implementar y actúa como **coordinador**: no escribe código ni lee la arquitectura, solo despacha cada tarea a un **subagente aislado** (Task tool, `general-purpose`, en background) que corre en su propio contexto y devuelve un resumen. Esto mantiene el contexto del orquestador liviano toda la corrida — **ya no necesitas `/compact` manual entre tareas**.

Trabaja en **olas (waves)**:

1. **Escanear y resolver.** Carga todas las tareas; una `pending` se *desbloquea* cuando todos sus `depends_on` están `completed`.
2. **Armar la ola (sin colisiones).** Del conjunto desbloqueado, selecciona un lote cuyos `file_scope` sean **disjuntos entre sí**. Dos tareas que comparten un archivo van en olas distintas.
3. **Reclamar.** Marca cada tarea de la ola como `in_progress` + lock antes de despachar (evita doble-toma entre terminales).
4. **Fan-out en background.** Lanza un subagente por tarea, **en paralelo**. Cada agente recibe un payload mínimo: `id`/`title`/`acceptance_criteria`/`file_scope`; la instrucción de **invocar la skill de `"skill"` y demostrarlo** en su reporte (la experticia vive en la skill: hacer el trabajo de forma genérica es una falla, no un atajo); de leer **primero** `documentation/conventions.md` y luego **solo** su `read_architecture_section`. **Frontera dura:** si necesita tocar un archivo fuera de su `file_scope`, debe **ABORTAR y reportarlo**, nunca editarlo. El agente devuelve un **reporte estructurado**: prueba de skill (`skill_invoked` + marcador específico), archivos modificados, cada criterio cumplido sí/no, y el comando de test/lint si aplica.
5. **Esperar y reconciliar (verificar, no confiar).** Un "listo" auto-reportado no basta. Marca `completed` **solo si pasan todas**:
   - (a) **Prueba de skill falsable (no solo presente).** El marcador `[SKILL-CONFIRMATION: <skill> | … ]` debe existir tal cual lo define ese `SKILL.md`, y se valida en orden: **(a.1) presencia + nombre** — existe y `<skill>` coincide con el `"skill"` de la tarea; **(a.2) anchor contra el diff** — todo path que el marcador nombra (`Components`, `Delivered Files`, `Files Reviewed`, `Files Audited`, `Implemented Files`) debe aparecer en el `git diff` de la tarea; un marcador que nombra cero archivos con diff no-vacío, o nombra un archivo ausente del diff, → reject; **(a.3) consistencia de veredicto** — si el marcador trae un campo de veredicto/score (`Verdict`, `Health Score`, `Safe to Merge`, `BLOCKING`), no debe contradecir los checks (d)/(e). Un marcador presente que falla (a.2) o (a.3) **se trata como prueba inexistente** — reject igual que si faltara. Esto es lo que hace la prueba falsable: un string libre que el agente podría inventar sin trabajar no sobrevive al cross-check contra el diff.
   - (b) `git diff --name-only` (más untracked) muestra que **todo** path tocado cae dentro del `file_scope`.
   - (c) los archivos declarados existen en el diff.
   - (d) el comando de test/lint, si lo hay, sale con código 0.
   - (e) los `acceptance_criteria` se cumplen objetivamente en el diff.

   Si algo falla → vuelve a `pending`, libera el lock y registra el motivo en el JSON.
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
- **Colisiones imposibles:** la ola exige `file_scope` disjuntos.

**Modelo secundario (opcional) — multi-terminal.** Los locks siguen existiendo, así que aún puedes abrir terminales extra con `/sdd-execute` si quieres más concurrencia que la de una sesión. Cada terminal estampa su lock y no pelea por la misma tarea.

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
- **El gate verifica, no confía** — la misma falsabilidad de la Fase 3, aplicada a las skills del propio gate. Cada Etapa 1–3 debe traer su `[SKILL-CONFIRMATION]` anclado al diff; el gate re-deriva el veredicto de QA de su **propia** corrida de tests, y un veredicto auto-reportado que contradice la evidencia (tests en rojo, archivos ausentes del diff, `Safe to Merge` incoherente con QA) se descarta y fuerza **NO-GO**.
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
| Una tarea nunca se desbloquea | Dependencia mal puesta en `depends_on` o una tarea quedó `in_progress` colgada | Revisa/edita el JSON en `.sdd/tasks/`; limpia el lock manualmente |
| El arquitecto intenta escribir código | — | Es comportamiento prohibido por diseño; reitera que la Fase 1 es solo contratos |
| Dos tareas pisan el mismo archivo | `file_scope` solapados puestos en la misma ola | Ajusta los `file_scope` para que sean disjuntos, o añade un `depends_on` entre ellas para serializarlas |
| Una tarea quedó colgada en `in_progress` | El agente falló sin reconciliar | Vuelve a poner `pending` y limpia el lock en el JSON; `/sdd-execute` la re-despachará |

---

## 10. Reglas de oro

1. **Un spec, un pipeline.** No mezcles features en el mismo `.sdd/tasks/`.
2. **Respeta los `[APPROVAL]`.** Son la oportunidad de corregir antes de que el costo suba.
3. **Lee solo la porción que necesitas.** El `read_architecture_section` existe para ahorrar contexto; no leas toda la arquitectura.
4. **`file_scope` disjuntos = paralelismo seguro.** Es lo que permite el fan-out de agentes; si dos tareas comparten archivos, serialízalas con `depends_on`.
5. **Verificar, no confiar.** Una tarea pasa a `completed` solo cuando la reconciliación lo prueba objetivamente — marcador de skill **anclado al diff** (los archivos que nombra existen en el `git diff` y su veredicto no contradice los tests), diff dentro del `file_scope` y tests en verde — no cuando el agente lo afirma.
6. **No declares el feature terminado sin un GO** de `/sdd-quality-gate`. El pipeline solo cierra con veredicto GO.
