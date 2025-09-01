# TUIZ Copilot Instructions

A dual-repository quiz platform with Express TypeScript backend (`tuiz-backend/`) and Next.js frontend (`tuiz-frontend/`). Built for real-time multiplayer gaming with Supabase auth integration.

## 🏗 Architecture Overview

- **Frontend**: Next.js 15.4.7 + React 19.1.0, shadcn/ui + CVA variants, Zustand state, Socket.io client
- **Backend**: Express + TypeScript, Socket.io server, Pino logging, unified error contracts
- **Auth Flow**: Frontend ↔ Supabase Auth directly; Backend verifies JWTs for protected APIs
- **Database**: Supabase (Postgres + RLS), migrations in `tuiz-backend/supabase/migrations/`

## 🚨 Critical Integration Points

### Auth Pattern (Frontend Direct to Supabase)

```tsx
// Frontend: Direct Supabase auth via useAuthStore
const { login, register } = useAuthStore();
await login({ email, password, rememberMe: true });

// Backend API calls: Always include Supabase JWT
const response = await fetch(`${cfg.apiBase}/api/protected`, {
  headers: { Authorization: `Bearer ${session.access_token}` },
});

// Backend: Verify tokens via supabase.auth.getUser() - NO middleware needed
// Never store sessions - stateless JWT verification only
```

### Unified Error Contract (Backend)

ALL non-2xx responses follow: `{ "error": "string", "message": "optional", "requestId": "optional" }`

```ts
// Examples from actual implementation:
{ "error": "invalid_payload", "message": "Invalid request data" }
{ "error": "invalid_credentials", "message": "Invalid email or password" }
{ "error": "duplicate_email", "message": "An account with this email already exists" }
```

### Environment Configuration

- **Backend**: `src/config/env.ts` - Zod validation, CI fallbacks, production CORS defaults
- **Frontend**: `src/config/config.ts` - auto-detects `localhost:8080` vs production backend URL

## 🎯 Development Workflows

### Backend Development

```bash
npm run dev        # ts-node-dev with hot reload on :8080
npm test          # Vitest (18+ tests) with real Supabase integration
npm run build     # TypeScript compilation to dist/
npm run typecheck # Strict TS validation
```

### Frontend Development

```bash
npm run dev       # Next.js dev server on :3000
npm test         # Vitest + RTL (80+ component tests)
npm run e2e      # Playwright E2E tests (13 smoke tests)
npm run typecheck # TS validation across all components
```

### Database Operations

```bash
cd tuiz-backend
supabase db reset              # Reset + apply all migrations
supabase migration new <name>  # Create timestamped migration
supabase db push              # Push local changes to remote
# Local dev runs on :54321 (API), :54322 (DB), :54323 (Studio)
```

### Socket.io Development

```bash
# Backend: Socket.io server auto-starts with Express
# Frontend: Auto-connects via SocketProvider in layout.tsx
# Events: server:hello, client:hello (basic connection test)
```

## 🎨 Frontend Patterns

### App Router Structure (Japanese-First UI)

```
src/app/
├── layout.tsx                 # Root layout with providers (lang="ja")
├── page.tsx                   # Home page with gradient background
├── (pages)/                   # Route groups for protected pages
│   ├── dashboard/page.tsx     # Main dashboard with quiz management
│   ├── create/page.tsx        # Quiz creation workflow
│   └── join/page.tsx          # Quiz joining interface
├── auth/
│   ├── login/page.tsx         # Japanese login form
│   └── register/page.tsx      # Japanese registration form
├── AnimationController.tsx    # Framer Motion provider
├── MotionProvider.tsx         # Animation configuration
├── metadata.ts               # SEO metadata configuration
├── robots.ts                 # SEO robots configuration
└── sitemap.ts               # Dynamic sitemap generation
```

### Component Architecture (shadcn/ui + CVA + Organizational Categories)

```
src/components/ui/
├── core/                      # Foundational components
│   ├── button.tsx            # 4 variants + gradient/tall custom
│   ├── card.tsx              # glass/accent variants for overlays
│   ├── typography.tsx        # Heading/Text with animation support
│   ├── layout.tsx            # Header/Main/Footer/Container primitives
│   ├── page-container.tsx    # Page-level wrapper with entrance animations
│   ├── animated-heading.tsx  # Float/glow/shimmer/typewriter effects
│   └── dashboard-header.tsx  # Dashboard-specific header with profile menu
├── forms/                    # Input and form components
│   ├── input.tsx            # 4 input variants (default/filled/flushed/unstyled)
│   ├── input-field.tsx      # Label + Input + Error wrapper
│   ├── password-field.tsx   # Password input with toggle visibility
│   ├── checkbox.tsx         # Custom checkbox with variant support
│   └── search-bar.tsx       # Search input with icon
├── data-display/            # Content display components
│   ├── badge.tsx           # Status/category badges
│   ├── auth-card.tsx       # Authentication card wrapper
│   └── quiz-card.tsx       # Complex quiz card with actions (96-line component)
├── feedback/               # User feedback and interaction
│   ├── scroll-area.tsx     # Custom scrollbar with gradient theming
│   ├── scroll-demo.tsx     # Interactive scrollbar showcase
│   ├── loader.tsx          # Loading states (Spinner + Loader variants)
│   ├── form-error.tsx      # Error message display
│   ├── form-success.tsx    # Success message display
│   └── validation-message.tsx # Field validation feedback
├── overlays/               # Modal and overlay components
│   ├── sidebar-filter.tsx  # YouTube-style filter modal (400+ lines)
│   └── profile-settings-modal.tsx # User profile management
└── navigation/
    └── redirect-link.tsx   # Styled navigation links
```

### Advanced CVA Pattern Implementation

```tsx
// Example: Complex component with multiple variant dimensions
const buttonVariants = cva('base-classes font-medium transition-all', {
  variants: {
    variant: {
      default: 'bg-primary text-primary-foreground hover:bg-primary/90',
      gradient: 'bg-gradient-to-r from-[#BFF098] to-[#6FD6FF] text-black hover:shadow-2xl',
      gradient2: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
      tall: 'h-12 px-6 py-3 text-lg',
      destructive: 'bg-red-400 hover:bg-red-500 text-white',
    },
    size: {
      sm: 'h-8 px-3 text-sm',
      md: 'h-10 px-4',
      lg: 'h-12 px-8',
    },
    loading: {
      true: 'cursor-not-allowed opacity-70',
      false: 'cursor-pointer',
    },
  },
  compoundVariants: [
    {
      variant: 'gradient',
      size: 'lg',
      class: 'transform hover:scale-105 transition-transform',
    },
  ],
  defaultVariants: { variant: 'default', size: 'md', loading: false },
});
```

### State Management Architecture (Zustand + Context Providers)

```tsx
// Auth store with comprehensive session management
export const useAuthStore = create<AuthState & AuthActions>()((set) => ({
  user: null,
  session: null,
  loading: false,

  login: async (data: LoginRequest) => {
    try {
      set({ loading: true });
      const response = await authService.login(data);
      set({ user: response.user, session: response.session, loading: false });
    } catch (error) {
      set({ loading: false });
      throw error; // Component handles UI feedback
    }
  },

  // Session restoration with expiration checking
  initializeAuth: () => {
    const authData = authService.getStoredAuthData();
    if (authData && !authService.isSessionExpired(authData.session)) {
      set({ user: authData.user, session: authData.session });
    } else {
      authService.clearAuthData();
      set({ user: null, session: null });
    }
  },
}));

// Credentials service for "Remember Me" functionality (email-only storage)
class CredentialsService {
  private readonly STORAGE_KEY = 'tuiz_remembered_credentials';
  private readonly EXPIRY_DAYS = 30;

  saveCredentials(email: string): void {
    const credentials = { email, timestamp: Date.now() };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(credentials));
  }

  getSavedCredentials(): { email: string } | null {
    // Auto-expires after 30 days, never stores passwords
  }
}
```

### Provider Architecture (Nested Layout Pattern)

```tsx
// app/layout.tsx - Strategic provider nesting
export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      {' '}
      {/* Japanese-first UI */}
      <body>
        <AuthProvider>
          {' '}
          {/* Initialize auth state from localStorage */}
          <AnimationProvider>
            {' '}
            {/* Framer Motion configuration */}
            <SocketProvider>
              {' '}
              {/* Socket.io auto-connection to backend */}
              {children}
            </SocketProvider>
          </AnimationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
```

### Design System Integration (Tailwind + Design Tokens)

```css
/* tokens.css - Comprehensive design token system */
:root {
  /* Primary gradient theme #BFF098 → #6FD6FF */
  --gradient-primary: linear-gradient(135deg, #bff098 0%, #6fd6ff 100%);
  --light-green: #bff098;
  --light-blue: #6fd6ff;

  /* 25+ gradient variations for component theming */
  --gradient-purple: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%);
  --gradient-sunset: linear-gradient(135deg, #f97316 0%, #ef4444 100%);

  /* Dark mode compatible scrollbar theming */
  --scrollbar-thumb: linear-gradient(135deg, #6fd6ff 0%, #bff098 100%);
}

// Custom scrollbar system with cross-browser support
.scrollbar-thin::-webkit-scrollbar {
  width: 6px;
}
.scrollbar-hidden {
  scrollbar-width: none;
}
```

### Advanced Form Patterns (Japanese UX)

```tsx
// Japanese form with credential persistence
export default function LoginPage() {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [rememberMe, setRememberMe] = useState(false);
  const { login, loading } = useAuthStore();

  // Auto-load remembered credentials on mount
  useEffect(() => {
    const savedCredentials = credentialsService.getSavedCredentials();
    if (savedCredentials) {
      setFormData((prev) => ({ ...prev, email: savedCredentials.email }));
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    // Japanese validation messages
    if (!formData.email) {
      setErrors({ email: 'メールアドレスを入力してください' });
      return;
    }

    // Credential persistence
    if (rememberMe) {
      credentialsService.saveCredentials(formData.email);
    } else {
      credentialsService.clearCredentials();
    }

    await login({ ...formData, rememberMe });
    router.push('/dashboard');
  };
}
```

### SEO & Japanese Internationalization

```tsx
// Comprehensive SEO with structured data
const SEO_CONFIG = {
  DEFAULT_TITLE:
    'TUIZ情報王｜リアルタイムクイズ作成・参加アプリ｜TUIZ参加できる学習プラットフォーム',
  DEFAULT_DESCRIPTION:
    'TUIZ情報王は、リアルタイムでクイズを作成・参加できる無料プラットフォームです',
  KEYWORDS: ['Quiz', 'TUIZ', 'TUIZ情報王', 'TUIZ参加', 'リアルタイムクイズ'],
};

// Structured data for different content types
export const StructuredData: React.FC<{ type: 'website' | 'quiz' | 'software' }> = ({ type }) => {
  const getStructuredData = () => {
    switch (type) {
      case 'quiz':
        return {
          '@context': 'https://schema.org',
          '@type': 'Quiz',
          name: 'TUIZ情報王',
          educationalLevel: 'All Levels',
          inLanguage: 'ja-JP',
        };
      // ... other types
    }
  };
};
```

### Testing Architecture (MSW + RTL + User-Centric)

```tsx
// setupTests.tsx - Comprehensive test environment
global.React = React;
import { server } from '@/__tests__/msw/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Custom render with providers
export function renderWithProviders(ui: React.ReactElement) {
  return render(<AnimationProvider>{ui}</AnimationProvider>);
}

// MSW handlers with realistic error responses
export const authHandlers = [
  http.post('*/auth/login', async ({ request }) => {
    const { email, password } = await request.json();

    if (email === 'test.user@example.com' && password === 'testPassword123') {
      return HttpResponse.json(mockAuthResponse);
    }

    return HttpResponse.json({ message: 'Invalid email or password' }, { status: 401 });
  }),
];
```

### Performance Optimizations (Server Components + Animations)

```tsx
// Server Component by default - minimal client JS
export default function QuizCard({ title, description }) {
  return (
    <Card variant="glass">
      <CardContent>
        <h3>{title}</h3>
        <p>{description}</p>
      </CardContent>
    </Card>
  );
}

// Client Component only when needed
('use client');
export function InteractiveQuizCard() {
  const [isActive, setIsActive] = useState(false);
  // Interactive logic here
}

// Animation system with entrance effects
<PageContainer entrance="scaleIn" className="min-h-screen">
  {/* Page content with scale-in animation */}
</PageContainer>;
```

## 🔧 Backend Patterns

### Project Structure (Clean Architecture Lite)

```
src/
├── app.ts              # Express app factory (no listen)
├── server.ts           # HTTP + Socket.io server with CORS
├── config/
│   ├── env.ts          # Zod validation, CI fallbacks, single source
│   └── cors.ts         # CORS allowlist with wildcard support
├── lib/
│   └── supabase.ts     # Client + Admin instances, mock for CI
├── middleware/
│   └── error.ts        # Unified error contract mapper
├── routes/
│   ├── auth.ts         # Register/login/logout with profile integration
│   └── health.ts       # Liveness + readiness checks
├── types/
│   └── auth.ts         # AuthResponse, AuthError interfaces
└── utils/
    ├── logger.ts       # Pino with requestId support
    └── validation.ts   # Zod schemas (Register/LoginSchema)
```

### Authentication Flow (No Middleware Pattern)

```ts
// Route validation + direct Supabase calls
router.post('/login', async (req, res) => {
  // 1. Validate with Zod schema
  const validation = LoginSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ error: 'invalid_payload', message: 'Invalid request data' });
  }

  // 2. Direct Supabase auth call
  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email: validation.data.email,
    password: validation.data.password
  });

  // 3. Error mapping with generic messages
  if (error) {
    return res.status(401).json({
      error: 'invalid_credentials',
      message: 'Invalid email or password'
    });
  }

  // 4. Profile data integration + response
  const profile = await getUserProfile(authData.user.id);
  res.status(200).json({ user: {...}, session: {...} });
});
```

### Validation Patterns

```ts
// utils/validation.ts - Zod schemas with domain rules
export const RegisterSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .optional(),
  displayName: z.string().min(1).max(50).optional(),
});

export type RegisterData = z.infer<typeof RegisterSchema>;
```

### Error Handling & Logging

```ts
// middleware/error.ts - Central error contract
export const errorMw: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = err.statusCode ?? 500;
  const requestId = res.getHeader('x-request-id') || undefined;

  logger.error({ err, requestId }, 'unhandled_error');

  res.status(status).json({
    error: status === 500 ? 'server_error' : (err.code ?? 'error'),
    message: err.message,
    requestId, // Optional tracing
  });
};

// utils/logger.ts - Pino with structured logging
export const logger = pino({
  level: env.LOG_LEVEL,
  // Never log secrets, tokens, or PII
  redact: ['password', 'token', 'authorization', 'cookie'],
});
```

### Database Integration (Supabase)

```ts
// lib/supabase.ts - Dual client pattern
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Profile integration example
async function getUserProfile(userId: string) {
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('username, display_name, role')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    logger.error({ error, userId }, 'Error fetching user profile');
    return null;
  }
  return profile;
}
```

### Socket.io Integration

```ts
// server.ts - Socket.io with CORS matching Express
const io = new SocketIOServer(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowed = getAllowedOrigins();
      if (originAllowed(origin, allowed)) {
        return callback(null, true);
      }
      logger.warn(`Socket.IO CORS: ${origin} not allowed`);
      callback(new Error(`CORS: ${origin} not allowed`));
    },
    credentials: true,
  },
});

io.on('connection', (socket) => {
  logger.info('socket.io connected');
  socket.emit('server:hello'); // Basic connection test
  socket.on('client:hello', () => logger.info('client greeted'));
});
```

### Testing with Real Supabase

```ts
// tests/auth.test.ts - Integration testing approach
describe('Auth Routes', () => {
  const app = createApp();
  const createdUserIds: string[] = [];

  afterEach(async () => {
    await cleanupTestUsers(createdUserIds);
    createdUserIds.length = 0;
  });

  it('should register user and create profile', async () => {
    const response = await request(app)
      .post('/auth/register')
      .send({ email: 'test@example.com', password: 'testpass123' });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('user');
    expect(response.body).toHaveProperty('session');
  });
});
```

## 🚀 Deployment Context

- **Frontend**: Vercel (auto-deploy from main branch)
- **Backend**: Render (manual deploy, uses `build.sh`)
- **Database**: Supabase hosted instance
- **CORS**: Production allowlist from `CLIENT_ORIGINS` env var

## 🧪 Testing Integration

### Backend Testing (18+ tests)

- Real Supabase connection for auth/database integration
- Complete user journeys: register → login → protected API calls
- Database profile creation and RLS policy validation
- Error contract validation across all endpoints
- CI-friendly with dummy credentials fallback

### Frontend Testing (80+ tests)

- Component rendering and user interactions with RTL
- Form validation and error handling scenarios
- MSW for API mocking with realistic error responses
- Responsive design testing across viewports
- Accessibility features (ARIA, keyboard navigation)
- E2E smoke tests with Playwright (13 tests)

### Testing Patterns

```tsx
// Component tests with MSW integration
describe('AuthForm', () => {
  it('handles login success flow', async () => {
    render(<AuthForm mode="login" />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'testpass123');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });
});

// Backend integration tests
it('should create user profile after registration', async () => {
  const response = await request(app).post('/auth/register').send(validUserData);

  expect(response.status).toBe(201);
  createdUserIds.push(response.body.user.id);

  // Verify profile was created
  const profile = await getUserProfile(response.body.user.id);
  expect(profile).toBeTruthy();
});
```

## ⚡ Performance Notes

- **Server Components**: Default for static content, minimal client JS
- **Socket.io**: Connection management in providers, room-based targeting
- **CSS**: Tailwind 4.x with design tokens in `tokens.css`, custom scrollbar system
- **Images**: Next.js Image optimization with proper alt text (Japanese UI)
- **Animations**: Framer Motion integrated via `AnimationProvider` with entrance effects (fadeIn, scaleIn, slideUp)
- **Bundle Optimization**: Strategic `'use client'` placement, provider pattern for context sharing

## 🔑 Security Practices

- **CORS**: Strict allowlist in production (`env.CLIENT_ORIGINS`)
- **Rate Limiting**: Applied to `/auth/*` and host-control endpoints
- **Input Sanitization**: Zod validation on every route, no raw SQL
- **Token Handling**: Stateless JWT verification, never log tokens
- **Credential Storage**: Email-only persistence with 30-day expiration, never store passwords
- **Generic Error Messages**: Prevent information disclosure in auth flows

## 🌐 Internationalization

- **Primary Language**: Japanese (`lang="ja"` in layout)
- **UI Text**: Japanese labels with English alt text for accessibility
- **SEO**: Localized metadata and Open Graph tags with structured data
- **Form Validation**: Japanese error messages (`メールアドレスを入力してください`)
- **Content**: TUIZ-specific terminology ("TUIZ参加", "TUIZ情報王") for brand consistency

---

_When implementing new features, follow the established patterns in each repository and maintain the separation of concerns between frontend auth (Supabase direct) and backend APIs (JWT verification)._
