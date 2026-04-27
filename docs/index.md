# SLaM – Smart Learning and Mathematics

## Überblick

**SLaM** (Smart Learning and Mathematics) ist ein KI-gestütztes, adaptives Lernsystem für Mathematik, das speziell für Schüler der Klassenstufen 5–13 entwickelt wurde. Das System kombiniert modernste Technologien mit pädagogischen Best Practices, um ein personalisiertes, effektives Lernerlebnis zu schaffen.

## Vision

SLaM transformiert den Mathematikunterricht durch:

- **Adaptive KI-Fragengenerierung**: Fragen passen sich automatisch an den Leistungsstand des Schülers an
- **Echtzeit-Feedback**: Sofortige, kontextbezogene Rückmeldungen zu Antworten
- **Gamification**: XP, Coins, Streaks und Belohnungen motivieren zum kontinuierlichen Lernen
- **Lehrerplattform**: Live-Monitoring und detaillierte Analytik für Lehrkräfte
- **Spaced Repetition**: Wissenschaftlich fundiertes Wiederholungssystem für nachhaltiges Lernen

## Technologie-Stack

### Frontend (Schüler-App)
- **Framework**: Flutter 3.27+ / Dart 3.6+
- **State Management**: Riverpod 2.6+ mit Code-Generierung
- **Design**: Material 3 mit Google Sans Flex
- **Plattformen**: iOS, Android, Web

### Backend (API & KI-Orchestrierung)
- **Runtime**: Cloudflare Workers (Edge Computing)
- **Framework**: Hono (TypeScript)
- **KI-Modelle**: Claude Sonnet 4.6, Claude Haiku 4.5, Gemini Pro 3, Gemini Flash 3
- **Datenbank**: Cloud Firestore
- **Authentifizierung**: Firebase Auth

### Lehrerplattform
- **Framework**: React 18 + TypeScript
- **State Management**: Zustand + TanStack Query
- **Build Tool**: Vite 5
- **Deployment**: Cloudflare Pages

## Kernfunktionen

### Für Schüler

**Adaptive Fragengenerierung**
- Automatische Anpassung an AFB-Niveau (I, II, III)
- Themenbasierte Lernpläne
- Multiple-Choice und Step-by-Step Fragen
- LaTeX-Unterstützung für mathematische Formeln

**Interaktive Lernhilfen**
- Gestufte Hinweise (3 Stufen)
- KI-gestützter Chat-Assistent
- GeoGebra-Visualisierungen
- Kollaboratives Canvas

**Gamification**
- XP-System mit Leveln
- Coins für Belohnungen
- Streak-System mit Freeze-Käufen
- Unlockable Themes

**Spaced Repetition**
- Automatische Wiederholungsplanung
- Gedächtnismodell nach SM-2 Algorithmus
- Personalisierte Wiederholungsintervalle

### Für Lehrkräfte

**Live-Monitoring**
- Echtzeit-Übersicht über aktive Schüler
- Status-Indikatoren (aktiv, idle, struggling, offline)
- Sitzungsfortschritt pro Schüler

**Analytik**
- Genauigkeitsstatistiken (7-Tage-Fenster)
- Themenbasierte Leistungsanalyse
- Streak- und XP-Übersicht
- Exportierbare Reports

**Klassenverwaltung**
- Drag-and-Drop Sitzplan-Editor
- Schülereinladungen per E-Mail
- Lernziele und Meilensteine

## Architektur-Highlights

### Enterprise-Grade Features

**Validation Middleware** (Backend)
- Composable Validation Factory
- Type-safe Schema-Definition
- Automatische Fehlerbehandlung

**Rate Limiting** (Backend)
- In-Memory Sliding Window
- IP-basierte Limitierung
- Cloudflare-aware (cf-connecting-ip)
- Automatische Cleanup-Mechanismen

**Structured Logging** (Backend & Frontend)
- JSON-strukturierte Logs mit Timestamps
- Log-Level (DEBUG, INFO, WARN, ERROR)
- Context-Objekte für Metadaten
- Production-safe (automatisches Stripping in Release-Builds)

**Code Splitting** (Lehrerplattform)
- Route-basiertes Lazy Loading
- Vendor Chunk Separation
- 90% Bundle-Size-Reduktion (562 KB → 55 KB initial)

**Zero-Warning Policy** (Flutter)
- Keine Deprecation Warnings
- Moderne API-Nutzung (Riverpod 3.0, Flutter 3.33+)
- Strikte Type Safety

## Deployment

### Produktion

- **App**: Firebase Hosting + App Stores
- **Backend**: Cloudflare Workers (Global Edge Network)
- **Lehrerplattform**: Cloudflare Pages
- **Datenbank**: Cloud Firestore (Multi-Region)

### URLs

- **Schüler-App**: `https://learn-smart.app`
- **Lehrerplattform**: `https://teacher.learn-smart.app`
- **Backend API**: `https://api.learn-smart.app`

## Sicherheit

- **Authentifizierung**: Firebase Auth mit Domain-Restriktion (@mvl-gym.de)
- **Autorisierung**: Firebase Custom Claims (Lehrer-Rolle)
- **Rate Limiting**: Schutz vor Missbrauch
- **Input Validation**: Strikte Validierung aller API-Eingaben
- **CORS**: Whitelist-basierte Origin-Kontrolle

## Performance

- **Backend**: < 50ms Antwortzeit (Edge Computing)
- **App**: 60 FPS UI-Rendering
- **Lehrerplattform**: < 2s Initial Load (Code Splitting)
- **Caching**: 7-Tage Firestore-Cache für Fragen

## Nächste Schritte

Für detaillierte technische Informationen siehe:

- [Architektur](architecture.md) – Systemdesign und Datenfluss
- [Backend](backend.md) – Cloudflare Workers API
- [Flutter App](app.md) – Mobile/Web Frontend
- [Lehrerplattform](teacher.md) – React Dashboard
