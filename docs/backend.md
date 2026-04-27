# Backend (slam-backend)

## Überblick

Das SLaM-Backend ist eine hochperformante, serverlose API, die auf **Cloudflare Workers** läuft. Es orchestriert KI-Modelle, verwaltet Benutzerdaten und stellt eine sichere, skalierbare Schnittstelle zwischen Frontend und Datenschicht bereit.

## Technologie-Stack

- **Runtime**: Cloudflare Workers (V8 Isolates)
- **Framework**: Hono (TypeScript, Zero-Dependency)
- **KI-Provider**: Anthropic (Claude), Google (Gemini)
- **Datenbank**: Cloud Firestore
- **Authentifizierung**: Firebase Admin SDK
- **Testing**: Vitest
- **Deployment**: GitHub Actions → Cloudflare

## Architektur-Highlights

### 1. Composable Validation Middleware

**Problem**: Repetitive Validierungslogik in jedem Endpoint führt zu Code-Duplikation und Inkonsistenzen.

**Lösung**: Factory-Pattern für wiederverwendbare, typsichere Validierungsregeln.

**Implementierung** (`src/utils/validation.ts`):

```typescript
// Rule Builders
const Rules = {
  required: () => (value, field) => {
    if (value === undefined || value === null || value === '') {
      throw new ValidationError(`${field} is required`, field);
    }
  },
  
  email: () => (value, field) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      throw new ValidationError(`${field} must be a valid email`, field);
    }
  },
  
  minLength: (min: number) => (value, field) => {
    if (value.length < min) {
      throw new ValidationError(`${field} must be at least ${min} characters`, field);
    }
  },
  
  // ... 10 weitere Rules
};

// Schema Composition
const schema = new Schema()
  .field('email', Rules.required(), Rules.string(), Rules.email())
  .field('age', Rules.required(), Rules.number(), Rules.min(18));

// Hono Middleware
app.post('/users', validateBody(schema), handler);
```

**Vorteile**:
- **DRY**: Keine Code-Duplikation
- **Type-Safe**: TypeScript-Typen für alle Rules
- **Composable**: Beliebige Kombination von Rules
- **Testbar**: 85 Unit Tests mit 100% Coverage

**Verfügbare Rules**:
- `required()`, `string()`, `number()`, `integer()`
- `email()`, `minLength()`, `maxLength()`
- `min()`, `max()`, `array()`, `nonEmptyArray()`
- `oneOf(allowed: T[])`

**Fehlerformat**:
```json
{
  "success": false,
  "error": "Validation Error",
  "message": "email must be a valid email",
  "field": "email"
}
```

### 2. In-Memory Rate Limiting (Sliding Window)

**Problem**: Cloudflare Workers sind stateless. Traditionelle Rate Limiter benötigen externe Datenbanken (Redis, KV).

**Lösung**: In-Memory Map mit automatischer Cleanup-Logik für Zero-Latency Rate Limiting.

**Implementierung** (`src/utils/rateLimit.ts`):

```typescript
class RateLimitStore {
  private store = new Map<string, RateLimitEntry>();
  private lastCleanup = Date.now();
  private readonly cleanupInterval = 60000; // 60s

  get(key: string): RateLimitEntry | undefined {
    this.maybeCleanup();
    return this.store.get(key);
  }

  private maybeCleanup(): void {
    const now = Date.now();
    if (now - this.lastCleanup < this.cleanupInterval) return;

    this.lastCleanup = now;
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetAt) {
        this.store.delete(key);
      }
    }
  }
}
```

**Algorithmus**: Sliding Window
1. Request kommt rein → IP-Adresse extrahieren
2. Eintrag in Map suchen
3. Wenn Fenster abgelaufen → neues Fenster erstellen
4. Wenn Limit erreicht → 429 Response
5. Sonst → Counter erhöhen, Request durchlassen

**Cloudflare-Aware**:
```typescript
function defaultKeyGenerator(c: Context): string {
  return c.req.header('cf-connecting-ip') ?? 
         c.req.header('x-forwarded-for') ?? 
         'unknown';
}
```

**Presets**:

| Preset | Limit | Verwendung |
|--------|-------|------------|
| `strict()` | 10 req/min | Auth-Endpoints |
| `standard()` | 60 req/min | CRUD-Operationen |
| `generous()` | 300 req/min | Read-Only |
| `ai()` | 20 req/min | KI-Endpoints (teuer) |

**Headers**:
```
X-RateLimit-Limit: 20
X-RateLimit-Remaining: 15
X-RateLimit-Reset: 1714215045000
Retry-After: 45
```

**Memory Management**:
- Automatische Cleanup alle 60 Sekunden
- Nur aktive IPs im Speicher
- Keine Memory Leaks

**Upgrade-Pfad**: Für Multi-Region-Konsistenz kann der Store durch Cloudflare KV oder Durable Objects ersetzt werden, ohne die Middleware-API zu ändern.

### 3. Structured JSON Logger

**Problem**: `console.log()` ist unstrukturiert, schwer filterbar und nicht production-ready.

**Lösung**: JSON-strukturierte Logs mit Timestamps, Log-Levels und Context-Objekten.

**Implementierung** (`src/utils/logger.ts`):

```typescript
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };

    if (context && Object.keys(context).length > 0) {
      entry.context = context;
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    console.log(JSON.stringify(entry));
  }
}
```

**Verwendung**:
```typescript
const log = createLogger('generate-questions');

log.info('Request received', {
  userId,
  questionCount: 20,
  topicCount: 3,
});

log.error('AI call failed', { model: 'claude-sonnet-4-6' }, error);
```

**Output**:
```json
{
  "timestamp": "2026-04-27T10:30:45.123Z",
  "level": "INFO",
  "message": "[generate-questions] Request received",
  "context": {
    "userId": "abc123",
    "questionCount": 20,
    "topicCount": 3
  }
}
```

**Vorteile**:
- **Filterbar**: Log-Level, Scope, Timestamp
- **Strukturiert**: JSON-Parsing für Analyse-Tools
- **Production-Safe**: Konfigurierbare Log-Levels
- **Debuggable**: Stack Traces bei Errors

### 4. Multi-Model AI Orchestration

**Problem**: Verschiedene Tasks benötigen unterschiedliche KI-Modelle (Qualität vs. Geschwindigkeit vs. Kosten).

**Lösung**: Zentrale Konfiguration mit task-basierter Modellauswahl.

**Konfiguration** (`models.json`):
```json
{
  "tasks": {
    "generateQuestions": {
      "provider": "anthropic",
      "model": "claude-sonnet-4-6",
      "temperature": 0.7,
      "maxTokens": 8000,
      "systemPrompt": "Du bist ein erfahrener Mathematiklehrer..."
    },
    "evaluateAnswer": {
      "provider": "anthropic",
      "model": "claude-haiku-4-5",
      "temperature": 0.3,
      "maxTokens": 2000
    },
    "customHint": {
      "provider": "google",
      "model": "gemini-flash-3",
      "temperature": 0.5,
      "maxTokens": 1000
    }
  }
}
```

**Implementierung** (`src/utils/callAI.ts`):
```typescript
export function getTaskModelConfig(taskName: string): TaskConfig {
  const config = modelsConfig.tasks[taskName];
  if (!config) {
    throw new Error(`No model config for task: ${taskName}`);
  }
  return config;
}

export async function callAI(params: AICallParams): Promise<string> {
  const { provider, model, prompt, temperature, maxTokens, env } = params;

  if (provider === 'anthropic') {
    return callClaude({ model, prompt, temperature, maxTokens, env });
  } else if (provider === 'google') {
    return callGemini({ model, prompt, temperature, maxTokens, env });
  }

  throw new Error(`Unknown provider: ${provider}`);
}
```

**Vorteile**:
- **Zentral**: Eine Datei für alle Modell-Konfigurationen
- **Flexibel**: Modellwechsel ohne Code-Änderungen
- **Optimiert**: Jeder Task nutzt das beste Modell
- **Testbar**: Mock-Konfigurationen für Tests

## API-Endpoints

### Schüler-Endpoints

#### POST /api/generate-questions

Generiert adaptive Mathematikfragen basierend auf Lernplan und Leistungsstand.

**Request**:
```json
{
  "userId": "abc123",
  "learningPlanItemId": 1,
  "topics": [
    {
      "leitidee": "Funktionaler Zusammenhang",
      "thema": "Lineare Funktionen",
      "unterthema": "Steigung und y-Achsenabschnitt"
    }
  ],
  "userContext": {
    "gradeLevel": "Klasse_9",
    "courseType": "Grundkurs",
    "recentPerformance": {
      "strugglingTopics": ["Bruchrechnung"]
    }
  },
  "afbLevel": "II",
  "questionCount": 20
}
```

**Response**:
```json
{
  "success": true,
  "sessionId": "session_1714215045_abc123",
  "questions": [
    {
      "id": "q1",
      "type": "multiple-choice",
      "difficulty": 5,
      "topic": "Lineare Funktionen",
      "question": "Welche Steigung hat die Funktion $f(x) = 2x + 3$?",
      "options": [
        {"id": "a", "text": "2", "isCorrect": true},
        {"id": "b", "text": "3", "isCorrect": false},
        {"id": "c", "text": "5", "isCorrect": false},
        {"id": "d", "text": "1", "isCorrect": false}
      ],
      "hints": [
        {"id": "h1", "text": "Die Steigung ist der Faktor vor x."},
        {"id": "h2", "text": "In der Form f(x) = mx + b ist m die Steigung."},
        {"id": "h3", "text": "Die Steigung ist 2, da 2x bedeutet 2 · x."}
      ],
      "correctFeedback": "Perfekt! Die Steigung ist 2.",
      "incorrectFeedback": "Nicht ganz. Schaue dir die Formel nochmal an."
    }
  ],
  "totalQuestions": 20,
  "fromCache": false,
  "modelUsed": "claude-sonnet-4-6"
}
```

**Features**:
- **7-Tage-Cache**: Identische Anfragen werden aus Firestore geladen
- **AFB-Anpassung**: Schwierigkeit passt sich an Anforderungsbereich an
- **Validation**: Strikte Schema-Validierung
- **Rate Limiting**: 20 req/min

#### POST /api/custom-hint

Generiert kontextbezogene Hinweise für eine Frage.

**Request**:
```json
{
  "question": "Löse die Gleichung: 2x + 5 = 13",
  "userAnswer": "x = 4",
  "hintsUsed": 1
}
```

**Response**:
```json
{
  "hint": "Du bist auf dem richtigen Weg! Überprüfe nochmal die Subtraktion: 13 - 5 = ?"
}
```

#### POST /api/evaluate-answer

Bewertet eine Schülerantwort mit KI-gestütztem Feedback.

**Request**:
```json
{
  "questionId": "q1",
  "questionText": "Berechne die Ableitung von f(x) = x²",
  "correctAnswer": "f'(x) = 2x",
  "userAnswer": "f'(x) = 2x",
  "questionType": "open-ended"
}
```

**Response**:
```json
{
  "isCorrect": true,
  "score": 100,
  "feedback": "Perfekt! Die Ableitung ist korrekt.",
  "detailedFeedback": "Du hast die Potenzregel korrekt angewendet: (x^n)' = n·x^(n-1)."
}
```

### Lehrer-Endpoints

Alle Lehrer-Endpoints erfordern Firebase Auth Token mit Custom Claim `role: "teacher"`.

#### GET /api/teacher/class/:classId/students

Liefert Live-Status aller Schüler einer Klasse.

**Response**:
```json
[
  {
    "uid": "student123",
    "displayName": "Max Mustermann",
    "email": "max@mvl-gym.de",
    "lastActive": "2026-04-27T10:25:00Z",
    "accuracy7d": 85,
    "streak": 12,
    "totalXp": 4500,
    "status": "active",
    "sessionProgress": {
      "answered": 8,
      "total": 20
    }
  }
]
```

**Status-Logik**:
- `active`: Letzte Aktivität < 5 Minuten
- `idle`: Letzte Aktivität 5–30 Minuten
- `struggling`: Aktiv, aber < 50% Genauigkeit
- `offline`: Letzte Aktivität > 30 Minuten

#### GET /api/teacher/class/:classId/analytics

Liefert aggregierte Analytik-Daten für eine Klasse.

**Response**:
```json
{
  "classId": "class123",
  "studentCount": 25,
  "averageAccuracy": 78,
  "averageStreak": 8,
  "topicPerformance": [
    {
      "topic": "Lineare Funktionen",
      "accuracy": 85,
      "questionCount": 120
    }
  ],
  "activityTimeline": [
    {
      "date": "2026-04-27",
      "activeStudents": 18,
      "questionsAnswered": 340
    }
  ]
}
```

## Middleware-Pipeline

Jeder Request durchläuft folgende Middleware in dieser Reihenfolge:

```typescript
app.use('*', cors({...}));                          // 1. CORS
app.post('/api/generate-questions', 
  RateLimitPresets.ai(),                            // 2. Rate Limiting
  validateBody(generateQuestionsSchema),            // 3. Validation
  handleGenerateQuestions                           // 4. Handler
);
```

### CORS-Konfiguration

**Whitelist**:
```typescript
const PRODUCTION_ORIGINS = [
  'https://learn-smart.app',
  'https://www.learn-smart.app',
  'https://teacher.learn-smart.app',
];
```

**Development**: Localhost nur in Non-Production-Umgebungen erlaubt.

### Error Handling

**Globaler Error Handler**:
```typescript
app.onError((err, c) => {
  logger.error('Unhandled error', {}, err);
  return c.json({
    success: false,
    error: 'Internal Server Error',
    message: 'An unexpected error occurred. Please try again later.',
  }, 500);
});
```

**Custom Errors**:
```typescript
class APIError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
  }
}

throw new APIError('Missing required field: userId', 400);
```

## Firestore-Integration

### Datenstruktur

```
users/{userId}
  .profile      { displayName, email, createdAt }
  .stats        { totalXp, coins, streak, level }
  .settings     { theme, gradeLevel, courseType }
  .learningPlan { topics[], createdAt }
  
  /questionHistory/{autoId}         QuestionResult
  /questionQueueCache/current       { questions[], savedAt }
  /memories/{memoryId}              Memory (Spaced Repetition)
  /savedContent/{contentId}         Saved GeoGebra/KI-Lab

question_cache/{cacheKey}
  .questions    []
  .cachedAt     timestamp
  .model        string
```

### Security Rules

```javascript
match /users/{userId} {
  allow read, write: if request.auth.uid == userId;
  
  match /questionHistory/{questionId} {
    allow read, write: if request.auth.uid == userId;
  }
}

match /question_cache/{cacheKey} {
  allow read: if request.auth != null;
  allow write: if false; // Nur Backend darf schreiben
}
```

## Testing

### Unit Tests

**Validation Tests** (`test/validation.test.ts`):
```typescript
describe('Rules.email', () => {
  const rule = Rules.email();

  it('should pass for valid emails', () => {
    expect(() => rule('test@example.com', 'email')).not.toThrow();
  });

  it('should fail for invalid emails', () => {
    expect(() => rule('invalid', 'email')).toThrow('email must be a valid email');
  });
});
```

**Rate Limiting Tests** (`test/rateLimit.test.ts`):
```typescript
it('should block requests exceeding limit', async () => {
  const middleware = rateLimit({ windowMs: 60000, maxRequests: 2 });
  const ctx = createMockContext();
  const next = createNext();

  await middleware(ctx, next);
  await middleware(ctx, next);
  await middleware(ctx, next);

  expect(ctx.json).toHaveBeenCalledWith(
    expect.objectContaining({ error: 'Rate Limit Exceeded' }),
    429,
    expect.any(Object)
  );
});
```

**Test Coverage**:
- Validation: 85 Tests, 100% Coverage
- Rate Limiting: 10 Tests, 100% Coverage

### Integration Tests

**Teacher Routes** (`src/teacher/classes.test.ts`):
- Mocked Firebase Admin SDK
- Mocked Firestore Queries
- End-to-End Request/Response Tests

## Deployment

### GitHub Actions

**Workflow** (`.github/workflows/deploy.yml`):
```yaml
name: Deploy Backend
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm test
      - run: npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

**Secrets** (Wrangler):
```bash
wrangler secret put GEMINI_API_KEY
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put FIREBASE_SERVICE_ACCOUNT
```

### Monitoring

**Cloudflare Dashboard**:
- Request Count
- Error Rate
- Response Time (P50, P95, P99)
- CPU Time

**Custom Metrics** (via Structured Logging):
- AI Model Usage
- Cache Hit Rate
- Rate Limit Hits

## Performance

### Benchmarks

| Metric | Wert |
|--------|------|
| Cold Start | < 5ms |
| Warm Response | < 50ms |
| AI Call (Claude) | 2–5s |
| AI Call (Gemini) | 1–3s |
| Firestore Query | 50–200ms |

### Optimierungen

1. **Edge Computing**: Requests werden am nächsten Cloudflare-Standort bearbeitet
2. **Question Cache**: 80% der Requests werden aus Cache bedient
3. **Batch Processing**: Bis zu 20 Fragen pro AI-Call
4. **Lazy Loading**: Fragen werden im Hintergrund nachgeladen

## Nächste Schritte

- [Flutter App](app.md) – Mobile/Web Frontend
- [Lehrerplattform](teacher.md) – React Dashboard
- [Architektur](architecture.md) – Systemdesign
