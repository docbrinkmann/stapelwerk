# UI-Prompt-Context — BuildMyStack

Kompaktes Briefing als Kontext für einen nachgelagerten UI-Prompt. Beantwortet drei Kernfragen und definiert Scope/Constraints.

---

## 1. Zielgruppe & Funktion der SaaS

**BuildMyStack ist KEIN Coolify/Dokploy-Klon.** Es ist ein **guided Docker-Stack-Builder als SaaS** — eine Web-App, die nicht-technischen Usern hilft, getestete Docker-Stacks visuell zu komponieren und als `docker-compose` zu exportieren.

### Abgrenzung

| Aspekt | Coolify / Dokploy | BuildMyStack |
|---|---|---|
| Rolle | Self-hosted PaaS / Deployment-Plattform | SaaS-Builder / Konfigurations-Wizard |
| Was passiert mit der Infrastruktur? | Plattform deployt direkt auf eigene Server | User bekommt `docker-compose` + Anleitung, deployt selbst |
| Kern-Entities | Server, Apps, Builds | **Stacks, Services, Templates** |

### Primäre Personas (aus `agent-os/product/mission.md`)
- Home-Tech-Enthusiasten (25–45) — wollen privat self-hosten
- Freelancer & SME-Owner (30–55) — kostengünstiges Hosting
- Kleine SysAdmins — überschaubare Deployments

### Kern-Features
- Visueller Stack-Builder (Drag & Drop)
- Service-Catalog mit Kompatibilitäts-Checks
- Template-Library (Media-Server, Dev, Business)
- Export zu `docker-compose`
- Deployment-Guides je Zielumgebung
- Logs- und Terminal-Views für laufende Stacks

### Belege im Code
- `README.md` — Produktbeschreibung
- `agent-os/product/mission.md` — Personas, Vision, Roadmap
- `prisma/schema.prisma` — Entities `stacks`, `services`, `categories`, `organization_templates`, `deployments` (= Export-/Validierungsjobs, **kein** Infra-Mgmt)
- `src/server/routers/` — `stacks.ts`, `services.ts`, `templates.ts`, `recommendations.ts` (Builder-Operationen)
- `src/app/` — `stack-builder/`, `services/`, `dashboard/` (keine `servers`/`infrastructure`-Sektionen wie bei Dokploy)

---

## 2. Frontend-Tech-Stack

### Framework & Sprache
- **Next.js 16.0.7** (App Router; Webpack-Modus, weil Pulumi mit Turbopack inkompatibel ist — siehe Commit `e058140`)
- **React 19.2.1**
- **TypeScript 5.9.2** — `strict: true`

### Styling & Design-System
- **Tailwind CSS 4.1.16** mit HSL-CSS-Variablen
- `tailwindcss-animate 1.0.7`
- `@tailwindcss/container-queries 0.1.1`
- `@tailwindcss/typography 0.5.19`
- `tailwind-merge 3.4.0`
- Tokens, fluide Typo & Spacing in `src/app/globals.css`
- `darkMode: 'class'` (siehe `tailwind.config.ts`)

### Komponenten-Bibliothek
- **shadcn/ui** — Style `new-york`, Base `stone` (siehe `components.json`)
- 30+ Komponenten unter `src/components/ui/` (button, card, input, label, skeleton, sidebar, sheet, dialog, alert-dialog, …)
- Radix-Primitives: Alert Dialog, Avatar, Checkbox, Dialog, Dropdown Menu, Progress, Radio Group, Select, Separator, Tabs, Toast, Toggle, Tooltip
- Icons: **`lucide-react 0.556.0`**

### State & Data-Fetching
- **tRPC 11.7.2** (15+ Router unter `src/server/routers/`)
- **TanStack Query 5.90.12** (+ devtools)
- **Zustand 5.0.9** (clientseitiger State, z. B. Service-Browser, Feature-Flags)
- **Immer 11.0.1**

### Forms & Validation
- **Zod 4.1.8** — Schema-Validation in Routern + Types

### Auth
- **NextAuth 4.24.13**

### Theming / Dark Mode
- **`next-themes` 0.4.6** — class-based Dark Mode (muss erhalten bleiben)

### Animations & Spezial-UI
- **`framer-motion` 12.23.25**
- `tailwindcss-animate`
- **Drag & Drop:** `@dnd-kit/core 6.3.1`, `@dnd-kit/sortable 10.0.0`, `@dnd-kit/modifiers 9.0.0`
- `react-grid-layout 1.5.2`
- Charts: `recharts 3.5.1`
- Command Palette: `cmdk 1.1.1`
- Virtualisierung: `@tanstack/react-virtual 3.13.12`
- Code-Highlighting: `react-syntax-highlighter 16.0.0`

### Realtime (Logs / Terminal)
- **xterm 5.3.0** + Addons (`fit`, `web-links`)
- `socket.io 4.8.1` (+ `socket.io-client 4.8.1`)
- `ws 8.18.3`
- Routes: `src/app/api/ws/`, Server: `src/server/ws/`
- Komponenten: `src/components/terminal/`, `src/components/logs/`

### Testing
- Vitest 4.0.15 (+ `@vitest/ui`, `@vitest/coverage-v8`)
- Playwright 1.57.0 (+ `@playwright/test 1.55.0`)
- Testing Library 16.3.0 (+ `@testing-library/dom`, `@testing-library/user-event`)
- `jest-axe 10.0.0`, `pa11y 9.0.1` — Accessibility im Build-Pipeline

### Observability
- OpenTelemetry, Sentry 10.29.0, `prom-client 15.1.3`, PostHog

### Aktuelle Layout-Patterns
- Dashboard-Layout: `src/app/dashboard/layout.tsx` mit shadcn `SidebarProvider` + `SidebarInset`
- Sidebar-Komponente: `src/components/ui/sidebar.tsx`
- Navigation/Breadcrumbs: `src/components/navigation/breadcrumbs.tsx`
- Refactor-Status: Letzter Commit `0ec781e feat(ui): Complete UI/UX refactor to Dokploy/Coolify design` — visuelle Sprache an Dokploy/Coolify-Patterns angelehnt

---

## 3. Prompt-Ziel — **Hybrid: System konsolidieren + gezielte Politur**

Kein kompletter Redesign-Reset. Aufbauend auf dem v1-Refactor wird das Design-System konsolidiert UND es werden gezielte UI-Verbesserungen umgesetzt.

### IN-SCOPE
- **Design-Tokens** härten: Farb-Skala, Semantik (success/warning/info/destructive), Surface-Layer
- **Spacing-Skala** konsolidieren (konsistente 4/8-px-Logik, keine Magic-Numbers)
- **Typo-Skala** vereinheitlichen (Sizes, Weights, Line-Heights, fluide Skalen)
- **Sidebar** aufpolieren (Hierarchie, aktive States, Collapse-Verhalten, Icon-Kohärenz)
- **Cards** (Stack-Cards, Service-Cards, Status-Cards) — Spacing, Hierarchie, Density-Optionen
- **Navigation & Breadcrumbs** — visuelle Hierarchie, Active-States
- **Dashboard-Hierarchie** — Heading-Skala, Section-Trennung, Empty-States
- Konsistenz in **Status-Indicators** (`src/components/status/`)

### OUT-OF-SCOPE
- Framework-Wechsel (Next.js / Tailwind / shadcn bleiben)
- Komplettes Redesign der visuellen Sprache (Dokploy/Coolify-Anlehnung bleibt)
- Neue Top-Level-Dependencies (UI-Bibliotheken, Icon-Sets, Animations-Libs)
- Architekturänderungen an tRPC, State-Management, Auth
- Brechende Änderungen an Realtime-Komponenten (Terminal, Logs)

---

## 4. Constraints & Hinweise für den UI-Prompt

- **Keine neuen Top-Level-Dependencies** vorschlagen, bevor der Status quo geprüft ist (`package.json` zuerst lesen).
- **shadcn/ui-Konventionen** einhalten: Style `new-york`, Base `stone`, Komponenten via shadcn-CLI-Pattern.
- **Tailwind 4 + CSS-Variablen** nutzen — keine Inline-Hex-Werte, keine Magic-Numbers.
- **Dark Mode** (`next-themes`, class-Strategie) muss erhalten bleiben — alle Tokens als Light/Dark-Paar.
- **Accessibility** ist im Build verdrahtet (`jest-axe`, `pa11y`, Playwright-A11y-Tests) — Kontraste, Focus-Rings, ARIA nicht regressieren.
- **TypeScript strict** — keine `any`-Schleichwege.
- **Realtime-Komponenten** (`xterm`, Socket.IO) nicht brechen — Layout-Änderungen müssen Resize-Verhalten respektieren.
- **App Router** + RSC — Client-Komponenten bewusst markieren (`"use client"`), keine Hydration-Issues einführen.
- **Webpack-Modus** ist gesetzt (Pulumi-Inkompat) — keine Turbopack-spezifischen Features verlangen.

---

## 5. Referenz-Dateien für den UI-Prompt

| Datei | Zweck |
|---|---|
| `src/app/dashboard/layout.tsx` | Aktuelles Dashboard-Shell (Sidebar + Inset) |
| `src/components/navigation/breadcrumbs.tsx` | Breadcrumb-Pattern |
| `src/components/ui/sidebar.tsx` | shadcn-Sidebar (Basis für Politur) |
| `src/app/globals.css` | Design-Tokens, fluide Skalen, Theme-Variablen |
| `tailwind.config.ts` | Tailwind-Konfig, Dark-Mode-Strategie |
| `components.json` | shadcn-Konfig (Style, Base, Aliases) |
| `src/components/status/` | Status-Indicators |
| `src/components/logs/`, `src/components/terminal/` | Realtime-Views — nicht brechen |
| `agent-os/specs/2025-12-09-ui-ux-refactor-dokploy-coolify-v2/spec.md` | Aktive UI-Spec (v2) |
| `package.json` | Versionen + verfügbare Deps |
