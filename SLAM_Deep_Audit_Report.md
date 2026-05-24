# SLAM Deep Audit Report

**Audit-Datum:** 2026-05-24  
**Reviewer:** Senior Software Architect & Security Auditor  
**Repositories:** slam-backend · slam-app · slam-teacher · slam-docs  
**Branch:** `claude/slam-deep-audit-nrWMR`

---

## Inhaltsverzeichnis

1. [Executive Summary](#1-executive-summary)
2. [Architektur & Datenfluss](#2-architektur--datenfluss)
3. [Backend — Cloudflare Workers / Hono / Firebase](#3-backend--cloudflare-workers--hono--firebase)
4. [SLAM App — Flutter / Riverpod](#4-slam-app--flutterriverpod)
5. [Teacher Dashboard — React / TanStack Query](#5-teacher-dashboard--react--tanstack-query)
6. [Action Plan — Sprint-Tickets nach Beta](#6-action-plan--sprint-tickets-nach-beta)

---

## 1. Executive Summary

### Stärken

- **Durchdachte Feature-Architektur:** Alle drei Clients (App, Teacher, Backend) verfolgen eine konsistente Feature-First-Struktur, die Onboarding und spätere Team-Skalierung erleichtert.
- **Asynchrones Job-Pattern:** Das HTTP-202-Polling-Muster für lang laufende KI-Anfragen (waitUntil + asyncJobs-Kollektion) ist für Cloudflare Workers idiomatisch und sinnvoll.
- **Typsicherheit:** TypeScript im Backend, Freezed-Modelle in Flutter, TanStack Query in React — alle Schichten setzen auf typsichere Datendarstellung.
- **Sicherheits-Layer vorhanden:** Firestore Security Rules schützen sensible Felder (`unlockedThemes`, `streakFreezes`); das Teacher-Backend nutzt JWT-Middleware korrekt.
- **Qualitatives KI-Konzept:** `evaluate-answer.ts` enthält eine ausgereifte Bewertungslogik mit algebraischer Äquivalenzprüfung, Misconception-Erkennung und XP-Kalkulation — das zeigt konzeptionellen Anspruch.

### Kritische Schwachstellen (Übersicht)

| # | Severity | Bereich | Titel |
|---|----------|---------|-------|
| C1 | **CRITICAL** | Backend | KI-Endpunkte vollständig unauthentifiziert |
| C2 | **CRITICAL** | Backend | `evaluate-answer.ts` ist totes Code — XP/Coins client-seitig |
| C3 | **CRITICAL** | Backend | Client-kontrollierter Kaufpreis in `purchase.ts` |
| C4 | **CRITICAL** | Backend | In-Memory Rate-Limiter funktionslos in Production |
| H1 | **HIGH** | Backend | TOCTOU Race Condition in `purchase.ts` |
| H2 | **HIGH** | Backend | Client kann beliebige Firebase-Credentials einschleusen |
| H3 | **HIGH** | Backend | Custom-Claims-Inkonsistenz (backend vs. Firestore Rules) |
| H4 | **HIGH** | Backend | Gemini System-Prompt Bug (`/n/n` statt `\n\n`) |
| M1 | **MEDIUM** | App | Auth-Token im Request-Body statt Authorization-Header |
| M2 | **MEDIUM** | Backend | N+1-Query-Pattern in `analytics.ts` |
| M3 | **MEDIUM** | Teacher | `useAiAssessment` macht POST in `useQuery` |
| M4 | **MEDIUM** | Backend | KV-Namespace auskommentiert (kein verteiltes Caching) |
| L1 | **LOW** | Docs | Dokumentation beschreibt Soll- statt Ist-Zustand |

---

## 2. Architektur & Datenfluss

### 2.1 Systemübersicht

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SLAM Ecosystem                              │
│                                                                     │
│  ┌──────────────┐    REST/JSON     ┌─────────────────────────────┐ │
│  │  slam-app    │ ──────────────►  │  slam-backend               │ │
│  │  (Flutter)   │                  │  (Cloudflare Workers/Hono)  │ │
│  │              │ ◄──────────────  │                             │ │
│  └──────┬───────┘    HTTP 202+Poll └────────────┬────────────────┘ │
│         │                                        │                  │
│         │ Firebase SDK                           │ Firebase REST    │
│         │ (direct!)                              │ Admin SDK        │
│         ▼                                        ▼                  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Firebase / Firestore                       │  │
│  │  users/{uid}  ·  asyncJobs/{jobId}  ·  question_cache/{...}  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│         ▲                                        ▲                  │
│         │ Firebase Auth                          │ Firebase REST    │
│         │ (direct!)                              │ Admin SDK        │
│  ┌──────┴───────┐                               │                  │
│  │ slam-teacher │ ─────── REST/JSON ─────────────┘                 │
│  │  (React)     │  (Authorization: Bearer JWT)                     │
│  └──────────────┘                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Datenfluss: Frage-Beantwortung (aktueller Ist-Zustand)

```
Flutter App                     Backend                    Firestore
    │                               │                          │
    │ POST /api/generate-questions  │                          │
    │ { topicId, firebaseConfig? }  │                          │
    │ (KEIN AUTH-HEADER)            │                          │
    │──────────────────────────────►│                          │
    │                               │ check question_cache     │
    │                               │─────────────────────────►│
    │                               │◄─────────────────────────│
    │                               │ (miss) → call AI API     │
    │ 202 { jobId }                 │                          │
    │◄──────────────────────────────│                          │
    │                               │ waitUntil: write job     │
    │                               │─────────────────────────►│
    │ GET /api/jobs/{jobId}         │                          │
    │ (polling, KEIN AUTH-HEADER)   │                          │
    │──────────────────────────────►│                          │
    │ { status: 'complete', data }  │                          │
    │◄──────────────────────────────│                          │
    │                               │                          │
    │ User beantwortet Frage        │                          │
    │ → XP/Coins lokal berechnet    │                          │
    │ → Firestore direkt schreiben  │                          │
    │───────────────────────────────────────────────────────►  │
    │ (Backend evaluate-answer.ts   │                          │
    │  existiert, ist aber NOT      │                          │
    │  REGISTERED in index.ts)      │                          │
```

### 2.3 Datenfluss: Kauf (aktueller Ist-Zustand — VERWUNDBAR)

```
Flutter App                     Backend                    Firestore
    │                               │                          │
    │ POST /api/purchase            │                          │
    │ { userId, itemType, itemId,   │                          │
    │   cost: 0,  ← CLIENT SENDET!  │                          │
    │   firebaseConfig? }           │                          │
    │──────────────────────────────►│                          │
    │                               │ READ userStats           │
    │                               │─────────────────────────►│
    │                               │◄─────────────────────────│
    │                               │ if (coins < cost)        │
    │                               │   = if (coins < 0)       │
    │                               │   → ALWAYS passes!       │
    │                               │ WRITE purchase           │
    │                               │─────────────────────────►│
    │ { success: true }             │                          │
    │◄──────────────────────────────│                          │
```

### 2.4 Soll-Architektur (nach Audit-Empfehlungen)

Der kritische Unterschied: **alle Spielmechanik-Entscheidungen wechseln in das Backend**. Die App wird rein zum Anzeigemedium.

```
Flutter App                  Backend (authoritative)         Firestore
    │                               │                          │
    │ POST /api/evaluate-answer     │                          │
    │ Authorization: Bearer {jwt}   │                          │
    │ { questionId, userAnswer }    │                          │
    │──────────────────────────────►│                          │
    │                               │ verifyFirebaseToken()    │
    │                               │ load question + answer   │
    │                               │─────────────────────────►│
    │                               │ evaluate (algebraic eq.) │
    │                               │ calculate XP/coins       │
    │                               │ atomic transaction       │
    │                               │─────────────────────────►│
    │ { correct, xpEarned, coins }  │                          │
    │◄──────────────────────────────│                          │
```

---

## 3. Backend — Cloudflare Workers / Hono / Firebase

### 3.1 CRITICAL — Unauthentifizierte KI-Endpunkte (C1)

**Datei:** `slam-backend/src/index.ts`

```typescript
// AKTUELLER STAND — KEINE AUTH für diese Routen:
app.use("/api/teacher/*", rateLimit({ windowMs: 60_000, maxRequests: 120 }));
app.use("/api/teacher/*", requireTeacher);

// Diese Routen haben KEINERLEI Schutz:
app.route("/api", generateQuestionsRouter);   // externe KI-Kosten!
app.route("/api", customHintRouter);           // externe KI-Kosten!
app.route("/api", purchaseRouter);             // Gamification-Logik!
app.route("/api", asyncJobsRouter);            // Job-Status-Leak!
```

**Risiko:** Jeder Internet-Nutzer kann beliebig viele KI-Anfragen auslösen, die reale API-Kosten verursachen (Claude/Gemini/OpenAI). Ohne Rate-Limiting (s. C4) gibt es keine Bremse.

**Fix:**

```typescript
// In src/middlewares/requireStudent.ts (NEU)
import { verifyFirebaseToken } from './verifyFirebaseToken';

export const requireStudent = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const token = authHeader.slice(7);
  try {
    const payload = await verifyFirebaseToken(token);
    c.set('uid', payload.sub);
    c.set('userPayload', payload);
    await next();
  } catch {
    return c.json({ error: 'Invalid token' }, 401);
  }
};

// In src/index.ts
app.use("/api/generate-questions", requireStudent);
app.use("/api/custom-hint", requireStudent);
app.use("/api/purchase", requireStudent);
app.use("/api/jobs/*", requireStudent);
```

---

### 3.2 CRITICAL — `evaluate-answer.ts` ist totes Code (C2)

**Dateien:** `slam-backend/src/api/evaluate-answer.ts`, `slam-backend/src/index.ts`

`evaluate-answer.ts` ist ein 26 KB großes, ausgereiftes Evaluierungsmodul mit algebraischer Äquivalenzprüfung, Misconception-Erkennung und server-seitiger XP-Berechnung. Es ist **nicht in `index.ts` registriert** und wird daher nie aufgerufen.

Stattdessen schreibt `slam-app/lib/core/services/firestore_service.dart` XP und Coins direkt über das Firestore-SDK in die Datenbank.

**Konsequenz:** Gamification ist vollständig cheatable. Ein Schüler kann mit einer modifizierten App beliebig hohe XP-Werte setzen. Die Firestore Rules erlauben `stats.xp` und `stats.coins` Schreibzugriff vom Client.

**Fix (Backend):**

```typescript
// In src/index.ts — Schritt 1: Router registrieren
import { evaluateAnswerRouter } from './api/evaluate-answer';
app.route("/api", evaluateAnswerRouter);

// Schritt 2: evaluate-answer.ts bekommt requireStudent Middleware
evaluateAnswerRouter.use('/', requireStudent);
```

**Fix (Firestore Rules):**

```javascript
// firestore.rules — stats darf Client NICHT mehr direkt schreiben
allow update: if isOwner(userId) &&
  !(
    request.resource.data.diff(resource.data).affectedKeys().hasAny(['stats'])
  );
// XP/Coins nur noch über Backend-Admin-SDK schreibbar
```

**Fix (Flutter App):**

```dart
// VORHER (in firestore_service.dart):
await _firestore.collection('users').doc(uid).update({
  'stats.xp': FieldValue.increment(xpDelta),
  'stats.coins': FieldValue.increment(coinsDelta),
});

// NACHHER (in ai_service.dart):
final result = await _dio.post(
  '/api/evaluate-answer',
  data: { 'questionId': qid, 'userAnswer': answer },
  options: Options(headers: {'Authorization': 'Bearer $token'}),
);
```

---

### 3.3 CRITICAL — Client-kontrollierter Kaufpreis (C3)

**Datei:** `slam-backend/src/api/purchase.ts`

```typescript
// VERWUNDBAR:
const { userId, itemType, itemId, cost, firebaseConfig } = body as PurchaseRequest;
// cost kommt vom Client! Niemand prüft, ob cost == tatsächlicher Itempreis

if (userStats.coins < cost) {
  return c.json({ error: 'Insufficient coins' }, 400);
}
// Angreifer sendet cost: 0 → Bedingung ist immer false → Kauf gratis
```

**Fix:**

```typescript
// Preistabelle server-seitig definieren (nie vom Client akzeptieren)
const ITEM_PRICES: Record<string, number> = {
  'theme:dark':        200,
  'theme:ocean':       350,
  'streak_freeze':     100,
  // ...
};

export async function handlePurchase(c: Context) {
  const { userId, itemType, itemId } = await c.req.json();
  
  const itemKey = `${itemType}:${itemId}`;
  const cost = ITEM_PRICES[itemKey];
  if (cost === undefined) {
    return c.json({ error: 'Unknown item' }, 400);
  }
  
  // Weiter mit server-seitigem cost ...
}
```

---

### 3.4 CRITICAL — In-Memory Rate-Limiter funktionslos (C4)

**Datei:** `slam-backend/src/utils/rateLimit.ts`

```typescript
// AKTUELLER STAND — module-level state:
const store: RateLimitStore = new Map<string, RateLimitEntry>();

export function rateLimit({ windowMs, maxRequests }: RateLimitOptions) {
  return async (c: Context, next: Next) => {
    const key = c.req.header('CF-Connecting-IP') ?? 'unknown';
    const entry = store.get(key); // Diese Map ist pro Worker-Isolate!
    // ...
  };
}
```

**Warum es nicht funktioniert:** Cloudflare Workers starten für jeden Request (oder eine kleine Gruppe) eine neue V8-Isolate. Module-Level-State wie `Map` wird NICHT zwischen Requests geteilt. Jeder Request sieht eine leere Map → keine effektive Begrenzung.

**Fix mit Cloudflare KV:**

```toml
# wrangler.toml — KV-Binding aktivieren (aktuell auskommentiert!)
[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "DEINE_KV_NAMESPACE_ID"
```

```typescript
// src/utils/rateLimit.ts — KV-basiert
export function rateLimit({ windowMs, maxRequests }: RateLimitOptions) {
  return async (c: Context, next: Next) => {
    const kv = c.env.RATE_LIMIT_KV;
    const ip = c.req.header('CF-Connecting-IP') ?? 'unknown';
    const window = Math.floor(Date.now() / windowMs);
    const key = `rl:${ip}:${window}`;
    
    const current = parseInt(await kv.get(key) ?? '0', 10);
    if (current >= maxRequests) {
      return c.json({ error: 'Too Many Requests' }, 429);
    }
    
    await kv.put(key, String(current + 1), { expirationTtl: Math.ceil(windowMs / 1000) });
    await next();
  };
}
```

**Alternativ:** Cloudflare Rate Limiting Rules im Dashboard konfigurieren (ohne Code-Änderung, aber weniger granular).

---

### 3.5 HIGH — TOCTOU Race Condition in `purchase.ts` (H1)

**Datei:** `slam-backend/src/api/purchase.ts`

```typescript
// VERWUNDBAR — Read-then-Write ohne Transaktion:
const userStatsDoc = await getFirestoreDoc(projectId, accessToken, `users/${userId}`);
const userStats = userStatsDoc.fields;

// Zwischen dem READ oben und dem WRITE unten kann ein zweiter
// concurrent Request denselben Coin-Stand lesen!
if (userStats.coins < cost) { /* ... */ }

await updateFirestoreDoc(projectId, accessToken, `users/${userId}`, {
  coins: userStats.coins - cost,
});
```

**Fix mit Firestore-Transaction:**

```typescript
// Atomarer Kauf via Firestore REST Transactions API
export async function handlePurchase(c: Context) {
  const { userId, itemType, itemId } = await c.req.json();
  const cost = ITEM_PRICES[`${itemType}:${itemId}`];
  
  const txResult = await runFirestoreTransaction(projectId, accessToken, async (tx) => {
    const userDoc = await tx.get(`users/${userId}`);
    const coins = userDoc.fields.stats?.coins ?? 0;
    
    if (coins < cost) throw new Error('INSUFFICIENT_COINS');
    
    tx.update(`users/${userId}`, {
      'stats.coins': coins - cost,
      [`unlockedItems.${itemType}`]: FieldValue.arrayUnion(itemId),
    });
  });
  
  return c.json({ success: true });
}
```

---

### 3.6 HIGH — Client kann beliebige Firebase-Credentials einschleusen (H2)

**Datei:** `slam-backend/src/utils/firebaseAuth.ts`

```typescript
export async function getFirebaseConfig(requestConfig?: ClientFirebaseConfig) {
  // KRITISCH: Keine Validierung der client-seitigen Credentials!
  if (requestConfig?.projectId && requestConfig?.accessToken) {
    return {
      projectId: requestConfig.projectId,
      accessToken: requestConfig.accessToken,  // Ungeprüfter Client-Token!
    };
  }
  // Fallback: Service Account (korrekt)
  return await getServiceAccountConfig();
}
```

Ein Angreifer könnte seinen eigenen `projectId` und `accessToken` einschleusen, um den Backend-Code gegen eine fremde Firebase-Instanz auszuführen.

**Fix:** `requestConfig`-Pfad vollständig entfernen. Das Backend MUSS immer die eigenen Service-Account-Credentials verwenden.

```typescript
export async function getFirebaseConfig(): Promise<FirebaseConfig> {
  // Niemals client-seitige Credentials akzeptieren
  return await getServiceAccountConfig();
}
```

**App-seitig:** Den `firebaseConfig`-Parameter aus allen API-Aufrufen in `ai_service.dart` entfernen. Die App sendet nur noch den Firebase ID-Token im Authorization-Header.

---

### 3.7 HIGH — Custom-Claims-Inkonsistenz (H3)

**Backend-Middleware** (`verifyTeacherToken.ts`):
```typescript
if (payload.role !== 'teacher') { return 401; }
```

**Firestore Rules** (`firestore.rules`):
```javascript
function isTeacher() {
  return request.auth.token.teacher == true;  // anderer Claim!
}
```

**Problem:** Ein Nutzer mit `role: 'teacher'` (JWT-Claim) kann die Teacher-API nutzen, aber NICHT auf Firestore-Daten zugreifen, die `isTeacher()` erfordern — und umgekehrt.

**Fix:** Auf einen einheitlichen Claim einigen und überall durchsetzen. Empfehlung: `role: 'teacher'` da es expresiv und für mehrere Rollen erweiterbar ist.

```javascript
// firestore.rules — anpassen:
function isTeacher() {
  return request.auth.token.role == 'teacher';
}
```

Außerdem: Beim Teacher-Onboarding (POST `/api/teacher/me`) müssen Custom Claims gesetzt werden — aktuell fehlt dieser Schritt komplett.

```typescript
// In src/teacher/me.ts — nach dem Erstellen des Teacher-Profils:
await setCustomClaims(uid, { role: 'teacher' });
// Hinweis: Client muss dann Token refreshen (forceRefresh: true)
```

---

### 3.8 HIGH — Gemini System-Prompt Bug (H4)

**Datei:** `slam-backend/src/utils/callAI.ts`

```typescript
// BUG: Literal /n/n statt Escape-Sequenz \n\n
contents.push({
  role: 'user',
  parts: [{ text: `System: ${systemPrompt}/n/n${prompt}` }]
  //                                       ^^^^
  //                          Hier fehlen die Backslashes!
});
```

**Auswirkung:** Gemini erhält den System-Prompt als einen langen, unformatierten String ohne Zeilenumbrüche. Die Trennung zwischen System-Anweisung und User-Prompt fehlt. Dies degradiert die Antwortqualität erheblich.

**Fix:**

```typescript
contents.push({
  role: 'user',
  parts: [{ text: `System: ${systemPrompt}\n\n${prompt}` }]
});
```

---

### 3.9 MEDIUM — N+1-Query-Pattern in `analytics.ts` (M2)

**Datei:** `slam-backend/src/teacher/analytics.ts`

```typescript
// Für jeden Schüler: 2 parallele Queries = 60 Firestore-Calls für 30 Schüler
const studentData = await Promise.all(
  studentIds.map(async (uid) => {
    const [history, userDoc] = await Promise.all([
      getFirestoreDocs(projectId, token, `users/${uid}/questionHistory`),
      getFirestoreDoc(projectId, token, `users/${uid}`),
    ]);
    return processStudentData(uid, history, userDoc);
  })
);
```

**Fix:** Firestore `batchGet`-API nutzen, um alle User-Dokumente in einem einzigen Request zu laden. History kann in einer Collection-Group-Query zusammengefasst werden.

```typescript
// Schritt 1: Alle UserDocs in einem Batch (1 Request statt N)
const userDocs = await batchGetFirestoreDocs(
  projectId, token,
  studentIds.map(uid => `users/${uid}`)
);

// Schritt 2: Collection Group Query für questionHistory
const allHistory = await queryFirestore(
  projectId, token,
  'questionHistory',  // Collection Group
  { where: [{ field: 'uid', op: 'in', value: studentIds }] }
);
```

---

## 4. SLAM App — Flutter/Riverpod

### 4.1 Architektur-Bewertung

Die App verwendet eine saubere Feature-First-Struktur mit Riverpod 2.6+ und Codegen. Freezed-Modelle und `riverpod_annotation` sind korrekt eingesetzt. Das Gesamtbild ist solide — die meisten Probleme liegen nicht im Flutter-Code selbst, sondern in der Backend-Integration.

### 4.2 Auth-Token im Request-Body (M1)

**Datei:** `slam-app/lib/core/services/ai_service.dart`

```dart
// AKTUELL: Token im Body, kein Authorization-Header
Future<String> generateQuestions(String topicId) async {
  final token = await _auth.currentUser?.getIdToken();
  final response = await _dio.post(
    ApiEndpoints.generateQuestions,
    data: {
      'topicId': topicId,
      'firebaseConfig': {
        'projectId': _projectId,
        'accessToken': token,  // Token im Body!
      }
    },
  );
}
```

**Problem:** Tokens im Request-Body werden in Access-Logs, Proxy-Logs und Browser-DevTools als Klartext sichtbar. Der Standard ist `Authorization: Bearer`.

**Fix:**

```dart
// In lib/core/services/api_client.dart — Interceptor hinzufügen
class AuthInterceptor extends Interceptor {
  final FirebaseAuth _auth;
  AuthInterceptor(this._auth);
  
  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await _auth.currentUser?.getIdToken();
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }
}

// In ai_service.dart — firebaseConfig aus dem Body entfernen
Future<String> generateQuestions(String topicId) async {
  final response = await _dio.post(
    ApiEndpoints.generateQuestions,
    data: { 'topicId': topicId },
    // Authorization-Header wird automatisch vom Interceptor gesetzt
  );
}
```

### 4.3 Doppelte Kauf-Logik (Bypass-Risiko)

**Datei:** `slam-app/lib/core/services/firestore_service.dart`

```dart
// METHODE 1: Backend-Aufruf (korrekt, aber cost kommt vom Client)
Future<void> purchaseThemeViaBackend(String themeId) async {
  await _aiService.purchaseItem('theme', themeId, cost: 350);
}

// METHODE 2: Direkter Firestore-Write (BYPASSES Backend!)
Future<void> purchaseTheme(String themeId) async {
  await _firestore.collection('users').doc(uid).update({
    'stats.coins': FieldValue.increment(-350),  // Preis: client-seitig!
  });
}
```

Die Firestore Rules blockieren direktes Schreiben von `unlockedThemes`, sodass Methode 2 für Theme-Käufe fehlschlägt. Aber `stats.coins` kann direkt dekrementiert werden — ein Angreifer könnte also Coins ohne Kauf reduzieren oder manipulieren.

**Fix:** Alle Kauf-Methoden aus `firestore_service.dart` entfernen. Einziger Kaufweg: Backend-API.

### 4.4 Token-Refresh bei Custom-Claims-Änderung

Wenn das Backend Custom Claims setzt (z. B. `role: 'teacher'` nach Onboarding), bleiben die Claims im lokal gecachten ID-Token bis zum nächsten automatischen Refresh (ca. 1 Stunde) veraltet.

**Fix:** Nach erfolgreichen Claim-ändernden Operationen den Token explizit refreshen.

```dart
// Nach Teacher-Onboarding oder Rollen-Zuweisung:
await FirebaseAuth.instance.currentUser?.getIdToken(true); // forceRefresh: true
```

### 4.5 Riverpod-Code-Qualität

- **Positiv:** `@riverpod`-Annotations, Freezed-Modelle, `AsyncValue`-Handling sind durchgängig korrekt eingesetzt.
- **Verbesserung:** `ref.watch` in `build`-Methode statt `ref.read` für reaktive Abhängigkeiten ist nicht überall konsequent — vereinzelt wird `ref.read` in Callback-Funktionen verwendet, was korrekt ist, aber bei State-abhängigen Berechnungen zu Inkonsistenzen führen kann.
- **Performance:** `firestore_service.dart` ist mit ~40 KB sehr groß und könnte in topic-spezifische Services aufgeteilt werden (z. B. `gamification_service.dart`, `question_service.dart`).

---

## 5. Teacher Dashboard — React / TanStack Query

### 5.1 Architektur-Bewertung

Das Teacher Dashboard ist architektonisch am saubersten von allen drei Clients. Die Zustand-Trennung (TanStack Query für Server-State, Zustand für UI-State) ist idiomatisch. Die `client.ts` setzt `Authorization: Bearer` korrekt. Die Lazy-Loading-Struktur in `App.tsx` ist sauber.

### 5.2 POST in useQuery — Strukturelles Anti-Pattern (M3)

**Datei:** `slam-teacher/src/api/hooks.ts`

```typescript
// ANTI-PATTERN: Mutation (POST) innerhalb einer Query (GET)
export function useAiAssessment(studentId: string) {
  return useQuery({
    queryKey: ['ai-assessment', studentId],
    queryFn: async () => {
      const { token } = useAuthStore.getState();
      // POST-Request innerhalb von useQuery!
      const response = await apiClient.post(
        `/teacher/students/${studentId}/assessment`,
        {}
      );
      return response.data;
    },
    staleTime: Infinity,         // Mildert das Problem
    refetchOnWindowFocus: false, // Mildert das Problem
    enabled: !!studentId,
  });
}
```

**Risiken:**
- React Query kann Queries automatisch re-fetchen (z. B. bei Netzwerkwiederkehr), was unbeabsichtigt mehrere POST-Requests auslöst.
- Semantisch falsch: Queries sollten idempotent sein; POST ist es nicht.
- Testschwer: TanStack Query-Tests gehen davon aus, dass `queryFn` idempotent ist.

**Fix:**

```typescript
// KORREKT: useMutation für POST-Requests
export function useAiAssessment() {
  return useMutation({
    mutationFn: async (studentId: string) => {
      const response = await apiClient.post(
        `/teacher/students/${studentId}/assessment`,
        {}
      );
      return response.data;
    },
    // Ergebnis cachen, wenn gewünscht:
    onSuccess: (data, studentId) => {
      queryClient.setQueryData(['ai-assessment', studentId], data);
    },
  });
}

// Verwendung in der Komponente:
const { mutate: requestAssessment, data, isPending } = useAiAssessment();
// Explizit auslösen statt automatisch:
<Button onClick={() => requestAssessment(studentId)}>KI-Analyse</Button>
```

### 5.3 Fehlerbehandlung in `App.tsx`

```typescript
// Aktuell: 404 → Onboarding, alle anderen Fehler → ErrorMessage
useEffect(() => {
  if (teacherError?.status === 404) {
    setShowOnboarding(true);
  } else if (teacherError) {
    setErrorMessage(teacherError.message);
  }
}, [teacherError]);
```

**Verbesserung:** 401/403-Fehler sollten zur Firebase-Sign-Out-Seite weiterleiten statt eine generische Fehlermeldung zu zeigen.

```typescript
useEffect(() => {
  if (!teacherError) return;
  if (teacherError.status === 404) {
    setShowOnboarding(true);
  } else if (teacherError.status === 401 || teacherError.status === 403) {
    signOut(auth); // Firebase Auth Sign-Out
  } else {
    setErrorMessage(teacherError.message);
  }
}, [teacherError]);
```

### 5.4 Beamer-Modus

`store.ts` enthält einen `beamerMode`-State. Es gibt keine offensichtliche UI-Komponente, die auf `beamerMode` reagiert (nur State-Mutation). Sicherstellen, dass alle sensiblen Daten (Noten, persönliche Details) im Beamer-Modus ausgeblendet werden — das ist ein häufig vergessenes Datenschutz-Feature.

---

## 6. Action Plan — Sprint-Tickets nach Beta

### Priorität 1 — Sicherheitskritisch (sofort vor Produktivgang)

---

**P1-001: KI-Endpunkte authentifizieren**  
*Estimated effort: 4h*

Alle `/api/*`-Routen (außer `teacher/*` die bereits geschützt sind) mit Firebase ID-Token-Verifikation absichern. Neuen `requireStudent`-Middleware erstellen, der Authorization-Header prüft.

Betroffene Dateien: `slam-backend/src/index.ts`, neues `src/middlewares/requireStudent.ts`

Akzeptanzkriterien:
- `POST /api/generate-questions` ohne Token → HTTP 401
- `POST /api/purchase` ohne Token → HTTP 401
- `GET /api/jobs/:id` ohne Token → HTTP 401
- Bestehende Tests weiter grün

---

**P1-002: `evaluate-answer.ts` registrieren & XP-Client-Writes sperren**  
*Estimated effort: 8h*

Backend: `evaluate-answer.ts` in `index.ts` registrieren. App: `addXpAndCoins()` aus `firestore_service.dart` entfernen; stattdessen Backend-Endpoint aufrufen. Firestore Rules: direktes Schreiben von `stats.xp` und `stats.coins` durch Client verbieten.

Betroffene Dateien: `slam-backend/src/index.ts`, `slam-app/lib/core/services/firestore_service.dart`, `slam-app/firestore.rules`

Akzeptanzkriterien:
- Client kann `stats.xp` nicht mehr direkt setzen (Firestore Rules test)
- Korrekte Antwort gibt XP (E2E-Test)
- Falsche Antwort gibt kein XP

---

**P1-003: Server-seitige Preisprüfung in `purchase.ts`**  
*Estimated effort: 3h*

`cost`-Parameter aus `PurchaseRequest` entfernen. Server-seitige `ITEM_PRICES`-Map einführen. Client sendet nur noch `itemType` + `itemId`.

Betroffene Dateien: `slam-backend/src/api/purchase.ts`, `slam-app/lib/core/services/ai_service.dart`

Akzeptanzkriterien:
- Request mit `cost: 0` wird ignoriert (cost nicht mehr im Body)
- Bekannte Items werden zu korrektem Preis abgerechnet
- Unbekannte Items → HTTP 400

---

**P1-004: Atomare Kauf-Transaktion (TOCTOU fix)**  
*Estimated effort: 4h*

Firestore-Transaktion für Kauf-Logik implementieren (Read + conditional Write in einem atomaren Schritt).

Betroffene Dateien: `slam-backend/src/api/purchase.ts`, evtl. neues `slam-backend/src/utils/firestoreTransaction.ts`

---

**P1-005: `firebaseConfig`-Client-Injection entfernen**  
*Estimated effort: 3h*

`getFirebaseConfig()` akzeptiert nur noch service-account-eigene Credentials. `firebaseConfig`-Felder aus allen API-Request-Bodies entfernen.

Betroffene Dateien: `slam-backend/src/utils/firebaseAuth.ts`, alle Handler-Dateien, `slam-app/lib/core/services/ai_service.dart`

---

**P1-006: KV-Namespace aktivieren & Rate-Limiter auf KV umstellen**  
*Estimated effort: 4h*

KV-Namespace in `wrangler.toml` aktivieren (Binding `RATE_LIMIT_KV`). `rateLimit.ts` auf KV-basierte Implementierung umstellen. Rate-Limiting auf alle `/api/*`-Routen ausweiten (nicht nur teacher).

Betroffene Dateien: `slam-backend/wrangler.toml`, `slam-backend/src/utils/rateLimit.ts`, `slam-backend/src/index.ts`

---

**P1-007: Custom-Claims-Inkonsistenz beheben**  
*Estimated effort: 2h*

Einheitlich auf `role: 'teacher'` migrieren. Firestore Rules anpassen. Teacher-Onboarding (`POST /api/teacher/me`) setzt Custom Claims via Admin SDK.

Betroffene Dateien: `slam-backend/src/teacher/me.ts`, `slam-app/firestore.rules`, `slam-backend/src/utils/verifyTeacherToken.ts`

---

### Priorität 2 — Qualität & Korrektheit (nächster Sprint)

---

**P2-001: Authorization-Header in Flutter-App (statt Body-Token)**  
*Estimated effort: 3h*

Dio-Interceptor für automatisches Anhängen des Firebase ID-Tokens erstellen. `firebaseConfig`-Felder aus allen Request-Bodies entfernen.

Betroffene Dateien: `slam-app/lib/core/services/api_client.dart` (neu/anpassen), `slam-app/lib/core/services/ai_service.dart`

---

**P2-002: Gemini System-Prompt Bug fixen**  
*Estimated effort: 30min*

`/n/n` → `\n\n` in `callAI.ts`.

Betroffene Datei: `slam-backend/src/utils/callAI.ts`

---

**P2-003: `useAiAssessment` auf `useMutation` umstellen**  
*Estimated effort: 2h*

`useQuery` durch `useMutation` ersetzen. Caching-Verhalten via `queryClient.setQueryData` beibehalten.

Betroffene Dateien: `slam-teacher/src/api/hooks.ts`, betroffene Komponenten

---

**P2-004: N+1-Queries in `analytics.ts` beheben**  
*Estimated effort: 4h*

Firestore `batchGet`-API für User-Dokumente nutzen. Collection-Group-Query für `questionHistory` evaluieren.

Betroffene Datei: `slam-backend/src/teacher/analytics.ts`

---

**P2-005: Beamer-Modus vollständig implementieren**  
*Estimated effort: 4h*

`beamerMode`-State in `store.ts` an alle relevanten Komponenten weitergeben. Sensible Felder (Name, individuelle Noten, E-Mail) ausblenden, wenn `beamerMode === true`. DSGVO-Anforderung.

Betroffene Dateien: `slam-teacher/src/store.ts`, Teacher-Dashboard-Komponenten

---

**P2-006: `firestore_service.dart` aufteilen**  
*Estimated effort: 3h*

40-KB-Service in `gamification_service.dart`, `question_service.dart`, `theme_service.dart` aufteilen. Doppelte Kauf-Methoden entfernen.

---

**P2-007: Token-Refresh nach Custom-Claims-Änderung**  
*Estimated effort: 1h*

Nach Teacher-Onboarding und evtl. Rollen-Änderungen `getIdToken(true)` aufrufen.

Betroffene Dateien: `slam-teacher/src/pages/Onboarding.tsx`, `slam-app/lib/features/auth/`

---

### Priorität 3 — Technische Schulden & Dokumentation

---

**P3-001: Dokumentation mit Ist-Zustand synchronisieren**  
*Estimated effort: 3h*

`slam-docs/docs/architecture.md` und `slam-docs/docs/security.md` aktualisieren:
- Rate-Limiting: Beschreibung anpassen (KV-basiert nach P1-006)
- JWT-Verifikation: Korrekte Beschreibung (nach P1-001)
- `evaluate-answer.ts`: Als aktiven Endpoint listen (nach P1-002)
- Datensatz-Fluss-Diagramme aktualisieren

---

**P3-002: Vitest-Tests für Security-kritische Pfade**  
*Estimated effort: 6h*

Unit-Tests ergänzen für:
- `purchase.ts`: Test dass `cost: 0` nicht zum Kauf führt
- `rateLimit.ts`: Test mit gemocktem KV
- `requireStudent`: Test mit ungültigem/fehlendem Token
- `evaluate-answer.ts`: Algebraische Äquivalenzprüfung (Tests existieren evtl. schon)

---

**P3-003: Firestore Security Rules — Integrations-Tests**  
*Estimated effort: 4h*

Firebase Emulator + `@firebase/rules-unit-testing` nutzen, um Rules automatisch zu testen:
- Schüler kann nicht `stats.xp` direkt setzen
- Schüler kann nicht `unlockedThemes` direkt setzen
- Teacher kann Klassen-Daten lesen
- Anonymer User kann nichts lesen

---

**P3-004: `wrangler.toml` — Environments vollständig konfigurieren**  
*Estimated effort: 2h*

Dev/Staging/Production-Environments in `wrangler.toml` vervollständigen. Sicherstellen, dass KV-Bindings pro Environment korrekt konfiguriert sind. Secrets-Management dokumentieren.

---

**P3-005: Fehlende evaluate-answer Firestore Rule**  
*Estimated effort: 1h*

Firestore Rules um `evaluations`-Kollektion erweitern (falls `evaluate-answer.ts` Ergebnisse schreibt). Sicherstellen, dass Schüler nur eigene Evaluierungen lesen können.

---

## Anhang: Datei-Index der Findings

| Finding | Datei | Zeile (ca.) |
|---------|-------|-------------|
| C1 | `slam-backend/src/index.ts` | 15-40 |
| C2 | `slam-backend/src/api/evaluate-answer.ts` | (nicht registriert) |
| C2 | `slam-app/lib/core/services/firestore_service.dart` | ~120-145 |
| C3 | `slam-backend/src/api/purchase.ts` | ~30-60 |
| C4 | `slam-backend/src/utils/rateLimit.ts` | 1-10 |
| H1 | `slam-backend/src/api/purchase.ts` | ~55-80 |
| H2 | `slam-backend/src/utils/firebaseAuth.ts` | ~10-20 |
| H3 | `slam-backend/src/utils/verifyTeacherToken.ts` | ~45 |
| H3 | `slam-app/firestore.rules` | ~15 |
| H4 | `slam-backend/src/utils/callAI.ts` | ~85 |
| M1 | `slam-app/lib/core/services/ai_service.dart` | ~30-60 |
| M2 | `slam-backend/src/teacher/analytics.ts` | ~40-70 |
| M3 | `slam-teacher/src/api/hooks.ts` | ~60-85 |
| M4 | `slam-backend/wrangler.toml` | KV-Sektion |
| L1 | `slam-docs/docs/security.md` | gesamte Datei |
| L1 | `slam-docs/docs/architecture.md` | gesamte Datei |

---

*Report generiert im Rahmen eines Deep-Code-Audits. Alle Findings wurden durch direktes Code-Reading verifiziert — kein automatisches Scanning. Fixes sind als konkrete Code-Snippets angegeben und können direkt in PRs umgesetzt werden.*
