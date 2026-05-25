---
title: Sicherheit & Datenschutz
description: Privacy-by-Design, Defense-in-Depth, Auth, Rate Limiting und DSGVO-Konformität.
---

## Überblick

SLaM verarbeitet sensible Leistungs- und Aktivitätsdaten von Schülern. Das System folgt einem strikten **Privacy-by-Design**- und **Defense-in-Depth**-Ansatz, um maximale Datensicherheit gemäß DSGVO-Richtlinien für den Schulbetrieb zu gewährleisten.

## Firestore Security Rules

Die Firebase Firestore Security Rules bilden das Rückgrat der Autorisierung. Jede Regel ist darauf ausgelegt, Daten strikt nach Benutzerrolle (Schüler vs. Lehrkraft vs. System) zu isolieren.

### 1. Strikte Daten-Isolation (Schüler)

Daten von Schülern sind vollständig gekapselt. Schüler können ausschließlich auf Dokumente zugreifen, die zu ihrer eigenen `userId` (`request.auth.uid`) gehören.

```javascript
function isAuthenticated() {
  return request.auth != null;
}

function isOwner(userId) {
  return isAuthenticated() && request.auth.uid == userId;
}

match /users/{userId} {
  allow read: if isOwner(userId);
  allow create: if isOwner(userId);
  
  match /generatedQuestions/{sessionId} {
    allow read, write: if isOwner(userId);
  }
}
```
**Wirkung**: Ein Schüler (Alice) kann niemals die Lernpläne, den Status oder die Fehlermetriken eines anderen Schülers (Bob) auslesen, nicht einmal durch manipulierte Client-Queries.

### 2. Teacher Access & Custom Claims

Lehrkräfte benötigen aggregierten Zugriff auf die Leistungsdaten der Schüler (`questionHistory`). Dieser Zugriff wird über **Custom Claims** gewährt, die ausschließlich vom Backend vergeben werden.

```javascript
function isTeacher() {
  return isAuthenticated() && request.auth.token.teacher == true;
}

match /users/{userId}/questionHistory/{resultId} {
  allow read: if isOwner(userId) || isTeacher();
  allow write: if isOwner(userId);
}
```
**Wirkung**: Nur Accounts mit dem kryptografisch signierten `teacher`-Claim dürfen die Historie anderer Benutzer lesen. Schüler können in diese Collection weiterhin nur eigene Resultate schreiben.

### 3. Schutz kritischer Felder (`.diff`)

Bestimmte Statistiken (z.B. gekaufte Themes aus dem Shop, XP-Multiplikatoren) dürfen nicht vom Client verfälscht werden, auch nicht vom Besitzer des Dokuments. Wir nutzen die `.diff()`-Funktion von Firestore, um partielle Updates zu kontrollieren.

```javascript
allow update: if isOwner(userId) &&    
  !(
    request.resource.data.diff(resource.data).affectedKeys().hasAny(['stats']) &&   
    request.resource.data.stats        
        .diff(resource.data.get(['stats'], {}))
        .affectedKeys().hasAny(['unlockedThemes', 'streakFreezes'])
  );
```
**Wirkung**: Der Schüler kann seinen eigenen Namen oder sein Avatar aktualisieren. Sobald er jedoch versucht, `stats.unlockedThemes` zu patchen, blockiert Firestore den Request. Diese kritischen Felder werden ausschließlich von der Cloudflare-Backend-Logik geschrieben (Admin SDK).

### 4. Schutz vor Löschung & Manipulation

```javascript
match /users/{userId} {
  allow delete: if false; // Blocks self-deletion
}
```
Um inkonsistente Zustände und Datenverlust (insbesondere für die Lehrer-Analytik) zu verhindern, ist die Kontolöschung für Clients (`delete: false`) gesperrt. Account-Deletion muss zwingend über einen Backend-Aufruf erfolgen, der alle verknüpften Subcollections sauber aufräumt.

### 5. Backend-Only Collections (`/asyncJobs`)

Asynchrone Hintergrund-Jobs (wie die Generierung von KI-Mini-Apps per HTTP 202 Polling) speichern ihre Resultate temporär in `/asyncJobs`.

```javascript
match /asyncJobs/{jobId} {
  allow read, write: if false;
}
```
**Wirkung**: Explizites **Deny-by-Default**. Selbst wenn ein Client die `jobId` errät, verbieten die Rules jeglichen Lesezugriff. Das Flutter-Frontend pollt das Cloudflare Backend (`GET /api/jobs/{jobId}`), welches als Admin SDK agiert und das fertige Resultat validiert an den Client durchreicht.

## Backend Security (Cloudflare Workers)

- **Composbale Validation**: Strikte Type- und Schema-Prüfung aller Payloads via Hono Middleware (Schutz vor NoSQL Injections).
- **IP-basiertes Rate-Limiting**: Verhinderung von Brute-Force- und DDoS-Angriffen, Sliding-Window im RAM.
- **Service Accounts**: Die Cloudflare Workers greifen via Firebase Admin SDK auf Firestore zu und verifizieren die JWT Bearer Token der Schüler/Lehrkräfte (`auth.verifyIdToken()`).

## Zusammenfassung
Die Architektur erzwingt das "Principle of Least Privilege". Der Flutter-Client gilt als untrustworthy, alle kritischen Berechnungen und Modifikationen (wie Einkäufe, KI-Bewertungen, XAI-Generierung) finden in der Edge-Umgebung statt. Die Datenbank-Regeln sichern die Kapselung final ab.