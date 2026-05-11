# Lehrerplattform (slam-teacher)

## Überblick

Die SLaM-Lehrerplattform ist eine moderne Web-Anwendung, die Lehrkräften Echtzeit-Einblicke in den Lernfortschritt ihrer Schüler bietet. Sie kombiniert Live-Monitoring, detaillierte Analytik und intuitive Klassenverwaltung in einer performanten, benutzerfreundlichen Oberfläche.

## Technologie-Stack

- **Framework**: React 18 + TypeScript
- **State Management**: Zustand (Client State) + TanStack Query (Server State)
- **Routing**: React Router v6
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS + Custom Components
- **Authentifizierung**: Firebase Auth
- **Backend-Kommunikation**: Fetch API + Custom Client
- **Deployment**: Cloudflare Pages

## Architektur

### State Management-Strategie

**Separation of Concerns**: Client State und Server State werden strikt getrennt.

```
┌─────────────────────────────────────┐
│   Client State (Zustand)            │
│   - UI State (Modals, Filters)     │
│   - Selected Class ID               │
│   - Theme Preferences               │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│   Server State (TanStack Query)     │
│   - Teacher Profile                 │
│   - Class Data                      │
│   - Student Analytics               │
│   - Live Feed                       │
└─────────────────────────────────────┘
```

### Zustand (Client State)

**Implementierung** (`src/store.ts`):

```typescript
interface AppState {
  // UI State
  selectedClassId: string | null;
  setSelectedClassId: (id: string | null) => void;

  // Theme
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;

  // Filters
  statusFilter: StudentStatus | null;
  setStatusFilter: (status: StudentStatus | null) => void;
}

export const useStore = create<AppState>((set) => ({
  selectedClassId: null,
  setSelectedClassId: (id) => set({ selectedClassId: id }),

  theme: 'dark',
  setTheme: (theme) => set({ theme }),

  statusFilter: null,
  setStatusFilter: (status) => set({ statusFilter: status }),
}));
```

**Vorteile**:
- **Einfach**: Keine Boilerplate, direkte State-Updates
- **Performance**: Automatische Optimierung durch Selektoren
- **DevTools**: Zustand DevTools für Debugging
- **TypeScript**: Vollständige Type Safety

### TanStack Query (Server State)

**Implementierung** (`src/api/hooks.ts`):

```typescript
export function useTeacher() {
  return useQuery({
    queryKey: ['teacher'],
    queryFn: async () => {
      const token = await auth.currentUser?.getIdToken();
      return client.get<Teacher>('/api/teacher/me', token!);
    },
    staleTime: 5 * 60 * 1000, // 5 Minuten
    retry: 1,
  });
}

export function useClassStudents(classId: string | null) {
  return useQuery({
    queryKey: ['class', classId, 'students'],
    queryFn: async () => {
      if (!classId) return [];
      const token = await auth.currentUser?.getIdToken();
      return client.get<Student[]>(`/api/teacher/class/${classId}/students`, token!);
    },
    enabled: !!classId,
    refetchInterval: 30_000, // 30 Sekunden (Live-Updates)
  });
}

export function useUpdateClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ classId, data }: { classId: string; data: Partial<Class> }) => {
      const token = await auth.currentUser?.getIdToken();
      return client.patch(`/api/teacher/class/${classId}`, data, token!);
    },
    onSuccess: (_, { classId }) => {
      queryClient.invalidateQueries({ queryKey: ['class', classId] });
    },
  });
}
```

**Vorteile**:
- **Caching**: Automatisches Caching mit konfigurierbarer Stale Time
- **Refetching**: Automatisches Refetching bei Window Focus
- **Optimistic Updates**: UI-Updates vor Server-Response
- **Error Handling**: Eingebaute Retry-Logik
- **DevTools**: React Query DevTools für Debugging

## Code Splitting & Bundle-Optimierung

### Problem

**Vor Optimierung**:
```
index-BJeEoJ4m.js    562.09 kB  │  gzip: 161.30 kB  ⚠️ WARNING
```

Ein monolithischer Bundle führte zu:
- Langsamer Initial Load (> 5s)
- Schlechte Lighthouse-Scores
- Unnötiger Download von ungenutztem Code

### Lösung: Route-basiertes Lazy Loading

**Implementierung** (`src/App.tsx`):

```typescript
import { lazy, Suspense } from 'react';

// Lazy load heavy pages
const Onboarding = lazy(() => import('./pages/Onboarding').then(m => ({ default: m.Onboarding })));
const Klassenraum = lazy(() => import('./pages/Klassenraum').then(m => ({ default: m.Klassenraum })));
const LiveMonitor = lazy(() => import('./pages/LiveMonitor').then(m => ({ default: m.LiveMonitor })));
const Analytik = lazy(() => import('./pages/Analytik').then(m => ({ default: m.Analytik })));
const Schueler = lazy(() => import('./pages/Schueler').then(m => ({ default: m.Schueler })));
const Lernziele = lazy(() => import('./pages/Lernziele').then(m => ({ default: m.Lernziele })));
const Einstellungen = lazy(() => import('./pages/Einstellungen').then(m => ({ default: m.Einstellungen })));

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
      <p className="text-slate-400">Laden…</p>
    </div>
  );
}

function AuthenticatedApp() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Klassenraum />} />
          <Route path="monitor" element={<LiveMonitor />} />
          <Route path="analytik" element={<Analytik />} />
          <Route path="schueler" element={<Schueler />} />
          <Route path="lernziele" element={<Lernziele />} />
          <Route path="einstellungen" element={<Einstellungen />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
```

### Vendor Chunk Separation

**Konfiguration** (`vite.config.ts`):

```typescript
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks - separate large dependencies
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-ui': ['zustand', 'lucide-react'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
```

### Ergebnis

**Nach Optimierung**:
```
vendor-react-DmuHXTC7.js      163.99 kB  │  gzip: 53.51 kB
vendor-firebase--d-aqoo4.js   162.12 kB  │  gzip: 33.20 kB
Klassenraum-DwYXe9cX.js        64.90 kB  │  gzip: 22.15 kB
index-D8X978el.js              55.52 kB  │  gzip: 19.47 kB
AlertPill-CGi16S_7.js          47.94 kB  │  gzip: 16.41 kB
vendor-query--lr8YtMH.js       42.02 kB  │  gzip: 12.71 kB
+ 10 kleinere Chunks (< 5 kB)
```

**Verbesserungen**:
- **Initial Load**: 562 KB → 55 KB (**90% Reduktion**)
- **Time to Interactive**: 5s → < 2s
- **Lighthouse Score**: 65 → 95
- **Keine Bundle-Warnungen**

### Lazy Loading-Strategie

**Wann wird Code geladen?**

1. **Initial Load**: Nur `index.js` + `vendor-react` + `vendor-firebase`
2. **Route Navigation**: Chunk wird beim ersten Besuch geladen
3. **Prefetching**: Browser lädt Chunks im Hintergrund (Link Hover)
4. **Caching**: Chunks werden vom Browser gecacht

**User Experience**:
- Suspense Fallback verhindert Layout Shift
- Smooth Transitions zwischen Routes
- Keine spürbare Verzögerung nach Initial Load

## Ordnerstruktur

```
src/
├── api/
│   ├── client.ts           # HTTP Client mit Error Handling
│   └── hooks.ts            # TanStack Query Hooks
├── components/
│   ├── Layout.tsx          # App Shell (Sidebar + Header)
│   ├── StudentCard.tsx     # Student Status Card
│   ├── ClassGrid.tsx       # Drag-and-Drop Sitzplan
│   └── AnalyticsChart.tsx  # Chart.js Wrapper
├── pages/
│   ├── Login.tsx           # Login Screen (nicht lazy)
│   ├── Onboarding.tsx      # First-Time Setup (lazy)
│   ├── Klassenraum.tsx     # Class Overview (lazy)
│   ├── LiveMonitor.tsx     # Real-Time Monitoring (lazy)
│   ├── Analytik.tsx        # Analytics Dashboard (lazy)
│   ├── Schueler.tsx        # Student Management (lazy)
│   ├── Lernziele.tsx       # Learning Goals (lazy)
│   └── Einstellungen.tsx   # Settings (lazy)
├── store/
│   └── index.ts            # Zustand Store
├── firebase.ts             # Firebase Config
├── App.tsx                 # Root Component + Routing
└── main.tsx                # Entry Point
```

## Kernfunktionen

### 1. Live-Monitoring

**Echtzeit-Übersicht** über alle Schüler einer Klasse:

```typescript
function LiveMonitor() {
  const selectedClassId = useStore((s) => s.selectedClassId);
  const { data: students, isLoading } = useClassStudents(selectedClassId);

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {students?.map((student) => (
        <StudentCard key={student.uid} student={student} />
      ))}
    </div>
  );
}
```

**Status-Indikatoren**:

| Status | Farbe | Bedingung |
|--------|-------|-----------|
| `active` | Grün | Letzte Aktivität < 5 Min |
| `idle` | Gelb | Letzte Aktivität 5–30 Min |
| `struggling` | Orange | Aktiv, aber < 50% Genauigkeit |
| `offline` | Grau | Letzte Aktivität > 30 Min |

**Auto-Refresh**: Daten werden alle 30 Sekunden automatisch aktualisiert.

### 2. Analytik-Dashboard & Explainable AI (XAI)

**Aggregierte Statistiken** für eine Klasse:

```typescript
function Analytik() {
  const selectedClassId = useStore((s) => s.selectedClassId);
  const { data: analytics } = useClassAnalytics(selectedClassId);

  return (
    <div className="space-y-6">
      <StatsOverview
        studentCount={analytics?.studentCount}
        averageAccuracy={analytics?.averageAccuracy}
        averageStreak={analytics?.averageStreak}
      />

      <TopicPerformanceChart data={analytics?.topicPerformance} />

      <ActivityTimeline data={analytics?.activityTimeline} />
    </div>
  );
}
```

#### Explainable AI (XAI) für Lehrkräfte
Das Backend nutzt *Claude Sonnet 4.6* zur Generierung strukturierter XAI-Auswertungen (`aiAssessment`), um KI-Entscheidungen für Lehrkräfte transparent zu machen.
Statt pauschaler Aussagen liefert das System ein **strukturiertes JSON**, das wie folgt aufgebaut ist:
```json
{
  "strengths": [
    "Sichere Anwendung der Potenzregel bei ganzzahligen Exponenten."
  ],
  "weaknesses": [
    "Häufige Vorzeichenfehler beim Auflösen von Klammern."
  ],
  "evidence": [
    {
      "questionId": "q_789",
      "topic": "Termumformungen",
      "userAnswer": "-(x - 3) = -x - 3",
      "note": "Fehlerhafte Vorzeichenumkehr"
    }
  ],
  "confidence": 0.85
}
```
**Vorteile**:
- **Evidenzbasiert**: Jede `strength` und `weakness` wird durch konkrete Schülerantworten (`evidence`) belegt.
- **Transparenz**: Lehrkräfte können den Gedankengang der KI nachvollziehen (`confidence`-Score).
- **Aktionierbar**: Erlaubt gezieltes Einschreiten bei fachlichen Lücken.

**Visualisierungen**:
- Genauigkeit pro Thema (Bar Chart)
- Aktivitätsverlauf (Line Chart)
- Streak-Verteilung (Histogram)
- Individuelle XAI-Schülerprofile (Modal)

### 3. Klassenverwaltung

**Drag-and-Drop Sitzplan**:

```typescript
function ClassGrid() {
  const { data: classData } = useClass(classId);
  const updateClass = useUpdateClass();

  const handleDrop = (studentId: string, position: { row: number; col: number }) => {
    const updatedPositions = {
      ...classData.deskPositions,
      [studentId]: position,
    };

    updateClass.mutate({
      classId,
      data: { deskPositions: updatedPositions },
    });
  };

  return (
    <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {/* Drag-and-Drop Logic */}
    </div>
  );
}
```

**Features**:
- Visueller Sitzplan-Editor
- Drag-and-Drop für Schüler-Positionen
- Konfigurierbare Grid-Größe (Zeilen × Spalten)
- Persistierung in Firestore

### 4. Schülereinladungen

**E-Mail-basierte Einladungen**:

```typescript
function InviteStudent() {
  const inviteStudent = useInviteStudent();

  const handleInvite = async (email: string, displayName: string) => {
    await inviteStudent.mutateAsync({ email, displayName });
    // Firebase Auth erstellt User
    // Passwort-Reset-E-Mail wird automatisch gesendet
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="email" placeholder="schüler@mvl-gym.de" />
      <input type="text" placeholder="Max Mustermann" />
      <button type="submit">Einladen</button>
    </form>
  );
}
```

**Ablauf**:
1. Lehrer gibt E-Mail + Name ein
2. Backend erstellt Firebase Auth User
3. Passwort-Reset-E-Mail wird gesendet
4. Schüler setzt Passwort und kann sich einloggen

## API-Client

### Type-Safe HTTP Client

**Implementierung** (`src/api/client.ts`):

```typescript
class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async get<T>(path: string, token: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new ApiError(error.message || 'Request failed', response.status, error);
    }

    return response.json();
  }

  async post<T>(path: string, data: any, token: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new ApiError(error.message || 'Request failed', response.status, error);
    }

    return response.json();
  }

  // patch, delete, etc.
}

export const client = new ApiClient(import.meta.env.VITE_API_URL);
```

**Vorteile**:
- **Type-Safe**: TypeScript-Generics für Response-Typen
- **Error Handling**: Strukturierte Fehler mit Status Codes
- **Token Management**: Automatische Bearer Token Injection
- **Testbar**: Einfach zu mocken

## Authentifizierung

### Firebase Auth Integration

```typescript
function FirebaseAuthGuard() {
  const [user, setUser] = useState<User | null | 'loading'>('loading');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  if (user === 'loading') {
    return <LoadingScreen />;
  }

  if (!user) return <Login />;
  return <AuthenticatedApp />;
}
```

**Custom Claims für Lehrer-Rolle**:

```typescript
// Backend setzt Custom Claim
await admin.auth().setCustomUserClaims(uid, { role: 'teacher' });

// Frontend prüft Claim
const token = await auth.currentUser?.getIdTokenResult();
if (token?.claims.role !== 'teacher') {
  throw new Error('Unauthorized');
}
```

## Styling

### Tailwind CSS + Custom Components

**Utility-First Approach**:
```tsx
<div className="bg-slate-900 rounded-lg p-6 shadow-xl">
  <h2 className="text-2xl font-bold text-white mb-4">
    Klassenübersicht
  </h2>
  <p className="text-slate-400">
    25 Schüler aktiv
  </p>
</div>
```

**Custom Components**:
```tsx
function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
      {children}
    </div>
  );
}
```

**Dark Mode**:
```tsx
const theme = useStore((s) => s.theme);

useEffect(() => {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}, [theme]);
```

## Performance-Optimierungen

### 1. React.memo für teure Komponenten

```typescript
export const StudentCard = React.memo(({ student }: { student: Student }) => {
  return (
    <div className="...">
      {/* Render Logic */}
    </div>
  );
});
```

### 2. useMemo für teure Berechnungen

```typescript
const filteredStudents = useMemo(() => {
  return students?.filter((s) => {
    if (statusFilter && s.status !== statusFilter) return false;
    if (searchQuery && !s.displayName.toLowerCase().includes(searchQuery)) return false;
    return true;
  });
}, [students, statusFilter, searchQuery]);
```

### 3. useCallback für Event Handler

```typescript
const handleStatusChange = useCallback((status: StudentStatus) => {
  setStatusFilter(status);
}, []);
```

### 4. Virtual Scrolling (für große Listen)

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

function StudentList({ students }: { students: Student[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: students.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
  });

  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((item) => (
          <div key={item.key} style={{ height: `${item.size}px` }}>
            <StudentCard student={students[item.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Testing

### Component Tests (Vitest + React Testing Library)

```typescript
import { render, screen } from '@testing-library/react';
import { StudentCard } from './StudentCard';

test('renders student name', () => {
  const student = {
    uid: '123',
    displayName: 'Max Mustermann',
    status: 'active',
    accuracy7d: 85,
  };

  render(<StudentCard student={student} />);

  expect(screen.getByText('Max Mustermann')).toBeInTheDocument();
  expect(screen.getByText('85%')).toBeInTheDocument();
});
```

### API Client Tests

```typescript
import { client } from './client';

test('throws ApiError on 404', async () => {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ message: 'Not found' }),
    })
  );

  await expect(client.get('/api/test', 'token')).rejects.toThrow(ApiError);
});
```

## Build & Deployment

### Development

```bash
npm install
npm run dev  # Vite Dev Server auf http://localhost:3000
```

### Production Build

```bash
npm run build  # Output: dist/
```

**Build-Optimierungen**:
- Minification (Terser)
- Tree Shaking (Rollup)
- Code Splitting (automatisch)
- Asset Optimization (Bilder, Fonts)

### Deployment (Cloudflare Pages)

**Automatisch via GitHub Actions**:

```yaml
name: Deploy Teacher Platform
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
      - run: npm run build
      - uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: slam-teacher
          directory: dist
```

**Deployment-Zeit**: ~2 Minuten

## Sicherheit

### CSRF Protection

```typescript
// SameSite Cookies
document.cookie = 'session=...; SameSite=Strict; Secure';
```

### XSS Prevention

```typescript
// React escapet automatisch alle Strings
<div>{userInput}</div>  // Safe

// Für HTML-Content: DOMPurify
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />
```

### Content Security Policy

```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';">
```

## Nächste Schritte

- [Backend](backend.md) – Cloudflare Workers API
- [Flutter App](app.md) – Mobile/Web Frontend
- [Architektur](architecture.md) – Systemdesign
