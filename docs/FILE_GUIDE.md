# File Guide

[← Back to README](../README.md)

A per-file breakdown of every source file in the Hangout repository. Files are grouped by module. Each entry documents the file's responsibility, its key exports, the state or parameters it manages, and its import/export relationships with other files.

---

## Table of Contents

- [Frontend](#frontend)
  - [Root Files](#root-files)
  - [`src/` — Application Entry](#src--application-entry)
  - [`src/pages/` — Route-Level Components](#srcpages--route-level-components)
  - [`src/components/` — Shared Components](#srccomponents--shared-components)
  - [`src/components/ui/` — Primitive UI Components](#srccomponentsui--primitive-ui-components)
  - [`src/lib/` — Utilities](#srclib--utilities)
  - [Test Files](#test-files)
- [Backend](#backend)
  - [`core/` — Project Configuration](#core--project-configuration)
  - [`users/` — Authentication App](#users--authentication-app)
  - [`meetings/` — Rooms, Signaling & Media App](#meetings--rooms-signaling--media-app)

---

## Frontend

The frontend is a React 19 SPA built with Vite. It lives entirely in `hangout/frontend/`.

---

### Root Files

#### `index.html`

**Purpose:** The single HTML shell for the Vite SPA. Contains the `<div id="root">` mount point and the `<script type="module" src="/src/main.jsx">` entry.  
**Key content:** Sets `<title>hangout</title>` and references `favicon.svg`.  
**Imports from:** Nothing (plain HTML).  
**Imported by:** Vite dev server / build pipeline.

---

#### `vite.config.js`

**Purpose:** Vite bundler configuration. Registers the `@vitejs/plugin-react` plugin (React Fast Refresh via Babel/SWC) and `@tailwindcss/vite` (Tailwind CSS v4 integration).  
**Key exports:** Default `defineConfig({...})` object.  
**Imports from:** `vite`, `@vitejs/plugin-react`, `@tailwindcss/vite`.

---

#### `package.json`

**Purpose:** Declares the project name (`hangout`), version, and all npm dependencies. Defines four scripts: `dev` (Vite dev server), `build`, `lint`, `preview`.  
**Notable dependencies:** See [Tech Stack in README](../README.md#tech-stack).

---

#### `eslint.config.js`

**Purpose:** ESLint configuration. Extends recommended rule sets for `@eslint/js`, `react-hooks`, and `react-refresh`. Sets browser globals.  
**Key exports:** Default config array.

---

#### `jsconfig.json`

**Purpose:** Editor (VS Code) configuration for JavaScript path resolution, enabling import auto-complete without TypeScript.

---

### `src/` — Application Entry

#### `src/main.jsx`

**Purpose:** The React application entry point. Creates the React root and renders `<App />` into `#root`.  
**Key operations:** `createRoot(document.getElementById('root')).render(<App />)`.  
**Imports from:** `react-dom/client`, `./index.css`, `./App.jsx`.  
**Imported by:** `index.html` (via `<script type="module">`).

---

#### `src/App.jsx`

**Purpose:** Root router component. Wraps the entire application in `<BrowserRouter>` and declares all client-side routes.

**Route table:**

| Path | Component | Notes |
|---|---|---|
| `/` | `<Landing />` | Public landing page |
| `/home` | `<Home />` | Protected; redirects to `/sign-in` if no session |
| `/sign-up` | `<SignUp />` | Public registration |
| `/sign-in` | `<SignIn />` | Public login |
| `/about` | `<About />` | Public about page |
| `/call/:roomId` | `<Call />` | Protected; dynamic room ID parameter |
| `*` | `<Navigate to="/" />` | 404 fallback |

**Key exports:** Default `App` function component.  
**Imports from:** `react-router-dom`, `./pages/Home`, `./pages/Landing`, `./pages/sign_up`, `./pages/sign_in`, `./pages/About`, `./pages/Call`.

---

#### `src/index.css`

**Purpose:** Global stylesheet. Loads three Google Fonts families (`Space Grotesk`, `Inter`, `JetBrains Mono`), applies the Tailwind CSS v4 base layer (`@import "tailwindcss"`), and defines three font utility classes (`.font-display`, `.font-body`, `.font-mono-ui`).  
**Imported by:** `src/main.jsx`.

---

### `src/pages/` — Route-Level Components

This group contains one file per route. Each is a full-page component rendered by the router in `App.jsx`.

---

#### `src/pages/Landing.jsx`

**Purpose:** The public landing page (`/`). Displays the animated WebGL shader gradient background and a centred "Get Started" CTA button that navigates to `/sign-in`.

**State:** None (stateless).

**Key logic:**
- Renders `<ShaderGradientCanvas>` with a `waterPlane` type shader using a dark grey/charcoal palette.
- The "Get Started" button calls `useNavigate()` to push `/sign-in`.

**Imports from:** `react`, `@shadergradient/react`, `../components/ui/button`, `react-router-dom`.  
**Imported by:** `App.jsx`.

---

#### `src/pages/sign_up.jsx`

**Purpose:** User registration form (`/sign-up`). Submits `{username, email, password}` to `POST /api/signup/`. On success, redirects to `/sign-in` after 1.5 seconds.

**State managed:**

| State | Type | Purpose |
|---|---|---|
| `formData` | `{username, email, password}` | Controlled form inputs |
| `showPassword` | `boolean` | Toggle password visibility |
| `toast` | `{message, type} \| null` | Ephemeral notification |
| `loading` | `boolean` | Disables submit button during request |

**Key exports:** Default `SignUp` function component.  
**Imports from:** `react`, `react-router-dom`, `axios`, `@shadergradient/react`.  
**Imported by:** `App.jsx`.

---

#### `src/pages/sign_in.jsx`

**Purpose:** Login form (`/sign-in`). Submits `{username, password}` to `POST /api/signin/`. On success, stores `username` in `sessionStorage` and navigates to `/home` with the preloader flag. Implements a client-side lockout countdown using `sessionStorage` (key: `lockoutUntil`).

**State managed:**

| State | Type | Purpose |
|---|---|---|
| `formData` | `{username, password}` | Controlled form inputs |
| `showPassword` | `boolean` | Toggle password visibility |
| `toast` | `{message, type} \| null` | Ephemeral notification |
| `loading` | `boolean` | Disables submit during request |
| `lockoutTimeRemaining` | `number` | Countdown seconds; initialised from `sessionStorage` |

**Key logic:**
- `useEffect` with `setInterval` ticks `lockoutTimeRemaining` down by 1 every second.
- On 429 response, writes `lockoutUntil = Date.now() + remaining * 1000` to `sessionStorage`.
- Accepts email in the `username` field (the backend handles lookup by email if direct username auth fails).

**Key exports:** Default `SignIn` function component.  
**Imports from:** `react`, `react-router-dom`, `axios`, `@shadergradient/react`.  
**Imported by:** `App.jsx`.

---

#### `src/pages/Home.jsx`

**Purpose:** The main post-login dashboard (`/home`). The largest page component outside `Call.jsx`. Manages four modal overlays and makes API calls to list recordings and notes on mount.

**Internal subcomponent:** `DigitalClock` — a stateful clock component rendered inline that updates every second via `setInterval`.

**State managed:**

| State | Type | Purpose |
|---|---|---|
| `showPreloader` | `boolean` | Triggers `<Preloader>` on navigation from sign-in |
| `joinCode` | `string` | Controlled input for room code entry |
| `showRecordingModal` | `boolean` | Opens the recordings history modal |
| `savedRecordings` | `array` | `[{id, room_id, file_url, created_at, days_remaining}]` |
| `loadingHistory` | `boolean` | Loading state for recordings fetch |
| `recordingsCount` | `number` | Badge count shown on the recordings stat card |
| `showNotesModal` | `boolean` | Opens the notes history modal |
| `savedNotes` | `array` | `[{id, room_id, content, created_at}]` |
| `loadingNotes` | `boolean` | Loading state for notes fetch |
| `notesCount` | `number` | Badge count shown on the notes stat card |
| `copiedNoteId` | `number \| null` | Tracks which note triggered the "Copied!" state |
| `preJoinRoomId` | `string \| null` | Triggers the pre-join permission modal |
| `camEnabled` | `boolean` | Pre-join camera toggle state |
| `micEnabled` | `boolean` | Pre-join microphone toggle state |
| `showLogoutModal` | `boolean` | Logout confirmation modal |

**Key functions:**

| Function | Description |
|---|---|
| `handleNewCall()` | Generates a random 7-char `roomId`, opens pre-join modal |
| `handleJoinCall()` | Uses `joinCode` as `roomId`, opens pre-join modal |
| `handleToggleCam()` | Requests camera permission probe; sets `camEnabled` |
| `handleToggleMic()` | Requests mic permission probe; sets `micEnabled` |
| `handleConfirmJoin()` | Navigates to `/call/{roomId}` with `{camEnabled, micEnabled}` state |
| `handleOpenRecordings()` | Fetches recordings from API, shows modal |
| `handleDeleteRecording(id)` | Deletes recording via API, updates state |
| `handleOpenNotes()` | Fetches notes from API, shows modal |
| `handleDeleteNote(id)` | Deletes note via API, updates state |
| `handleLogout()` | Clears `sessionStorage.username`, navigates to `/sign-in` |

**Imports from:** `react`, `react-router-dom`, `axios`, `../components/Preloader`, `../components/WeatherCard`, `./Home.css`, `lucide-react`.  
**Imported by:** `App.jsx`.

---

#### `src/pages/Home.css`

**Purpose:** The design system stylesheet for the Home and About pages. Defines CSS custom properties (design tokens) and all neomorphic component classes.

**Design tokens (`:root`):**

| Variable | Value | Role |
|---|---|---|
| `--bg` | `#2a2e35` | Page background |
| `--bg-elevated` | `#2c3038` | Card surface |
| `--shadow-dark` | `#1c1f24` | Neomorphic dark shadow |
| `--shadow-light` | `#383d47` | Neomorphic light shadow |
| `--text-primary` | `#FFFFE3` | Primary text (warm white) |
| `--accent` | `#D47E30` | Orange accent |
| `--danger-soft` | `#e08a6d` | Soft red for destructive actions |

**Component classes defined:** `.home-container`, `.neo-raised`, `.neo-inset`, `.neo-pill-btn`, `.neo-icon-circle`, `.card`, `.topbar`, `.brand`, `.avatar`, `.greeting`, `.grid-top`, `.grid-bottom`, `.stat-card`, `.join-btn`, `.clock-wrap`, `.modal-overlay`, `.modal-content`, `.modal-item`, and more.

**Also imports:** `Pramukh Rounded` font from Fontshare CDN.  
**Imported by:** `Home.jsx`, `About.jsx`.

---

#### `src/pages/Call.jsx`

**Purpose:** The full in-call interface (`/call/:roomId`). At 1,405 lines, this is the most complex file in the project. It owns the complete WebRTC mesh signalling logic, the media control toolbar, the side panel (chat + notes), video grid rendering, screen sharing, video filters, canvas-based recording, and music streaming.

**Refs (mutable, do not trigger re-render):**

| Ref | Type | Purpose |
|---|---|---|
| `localVideoRef` | `HTMLVideoElement` | Local camera / screen share video element |
| `wsRef` | `WebSocket` | Active WebSocket connection to signaling server |
| `localStreamRef` | `MediaStream` | Local camera + mic stream |
| `screenStreamRef` | `MediaStream` | Active screen share stream |
| `fileInputRef` | `HTMLInputElement` | Hidden file input for music file upload |
| `localAudioElementRef` | `HTMLAudioElement` | Audio element for local music file playback |
| `mediaRecorderRef` | `MediaRecorder` | Active recording session |
| `recordedChunksRef` | `Blob[]` | Accumulates recorded data chunks |
| `animationFrameIdRef` | `number` | rAF handle for the canvas drawing loop |
| `peerConnectionsRef` | `{[username]: RTCPeerConnection}` | All active peer connections (keyed by username) |
| `iceCandidateQueue` | `{[username]: RTCIceCandidate[]}` | Candidates buffered before remote description is set |

**State managed:**

| State | Type | Purpose |
|---|---|---|
| `isRecording` | `boolean` | Recording in progress |
| `showMusicCard` | `boolean` | Music streaming picker modal |
| `isMicOn` | `boolean` | Local mic enabled |
| `isCameraOn` | `boolean` | Local camera enabled |
| `isScreenSharing` | `boolean` | Local screen share active |
| `activeScreenSharer` | `string \| null` | Username of whoever is screen sharing |
| `isMaximized` | `boolean` | Presenter view maximized (hides sidebar) |
| `activeFilter` | `string` | CSS filter ID applied to local video |
| `peerFilter` | `string` | CSS filter ID to apply to remote videos |
| `remoteStreams` | `[{username, stream, isMicOn, isCameraOn}]` | All remote participants and their streams |
| `myUsername` | `string` | Loaded from `sessionStorage.username` on mount |
| `notification` | `string` | Transient in-call banner message |
| `showFilters` | `boolean` | Filters tray visibility |
| `panel` | `'notes' \| 'chat' \| null` | Active side panel |
| `copied` | `boolean` | Room ID copy feedback |
| `notes` | `string` | Notes textarea content |
| `notesCopied` | `boolean` | Notes copy feedback |
| `chatInput` | `string` | Chat input value |
| `messages` | `[{from, text, time}]` | In-call chat message list |
| `elapsed` | `number` | Call duration in seconds |

**Key functions:**

| Function | Description |
|---|---|
| `connectWebSocket(username)` | Opens WS connection; wraps `send` for logging; dispatches all incoming signal types via a `switch` |
| `initializePeerConnection(peer, isCaller, me)` | Creates `RTCPeerConnection`, adds local tracks, sets up `ontrack`, `onicecandidate`, `onnegotiationneeded` |
| `handlePeerDisconnect(username)` | Closes + deletes peer connection, removes from `remoteStreams` |
| `toggleMic()` | Toggles audio track; dynamically requests mic if no track exists; syncs all peer senders |
| `toggleCamera()` | Toggles video track; dynamically requests camera if no track exists; syncs all peer senders |
| `toggleScreenShare()` | Calls `getDisplayMedia`; replaces video sender track on all peers; sets max bitrate to 5 Mbps; broadcasts `screen-share-start` |
| `stopScreenSharing()` | Restores camera track on all peer senders; broadcasts `screen-share-stop` |
| `toggleRecording()` | Starts/stops canvas compositor + `MediaRecorder`; on stop, uploads blob via `POST /api/recordings/upload/` |
| `handleFilterChange(id)` | Sets active filter; broadcasts `change-filter` via WebSocket |
| `sendChat()` | Appends to local `messages`; broadcasts `chat-message` via WebSocket |
| `handleMusicFileChange(e)` | Plays a local audio file and adds its track to all peer connections |
| `startSystemAudioShare(url)` | Opens a service URL and calls `getDisplayMedia({audio:true})` to capture tab audio |
| `getGridDimensions(count)` | Returns `{cols, rows}` for the CSS grid based on participant count |

**Video layout modes:**
- **Grid mode** (no screen sharer): CSS grid with dynamic column/row count (`getGridDimensions`).
- **Presenter mode** (someone is sharing): 75% stage area + 25% vertical sidebar. Toggled by `activeScreenSharer !== null`.
- **Maximized presenter mode**: Sidebar hidden (`isMaximized`).

**WebRTC ICE server:** `stun:stun.l.google.com:19302` (hardcoded, no TURN server).

**Imports from:** `react`, `react-router-dom`, `axios`, `lucide-react`.  
**Imported by:** `App.jsx`.

---

#### `src/pages/About.jsx`

**Purpose:** Static informational page (`/about`) listing features and developer profiles with LinkedIn links.

**State:** None (stateless).

**Key exports:** Default `About` function component.  
**Imports from:** `react`, `react-router-dom`, `lucide-react`, `./Home.css`.  
**Imported by:** `App.jsx`.

---

### `src/components/` — Shared Components

Components in this folder are imported by multiple pages.

---

#### `src/components/Preloader.jsx`

**Purpose:** A full-screen animated preloader displayed immediately after sign-in. Cycles through "Hello" in 8 languages (`Hello`, `Bonjour`, `Ciao`, `Olà`, `やあ`, `Hallå`, `Guten tag`, `হ্যালো`) at 120 ms intervals, then SVG-animates upward off-screen before calling `onComplete`.

**Props:**

| Prop | Type | Required | Description |
|---|---|---|---|
| `onComplete` | `function` | No | Called after the exit animation finishes; used by `Home.jsx` to set `showPreloader = false` |

**State managed:**

| State | Type | Purpose |
|---|---|---|
| `index` | `number` | Current word index in the `words` array |
| `dimension` | `{width, height}` | Window dimensions for SVG path calculation |
| `isExiting` | `boolean` | Triggers the exit animation variant |

**Animation system:** Uses Framer Motion `motion.div` and `motion.p` with named variants (`slideUp`, `opacity`). The SVG path uses a quadratic Bézier curve that flattens on exit to create a smooth wipe.

**Key exports:** Default `Preloader` function component.  
**Imports from:** `react`, `framer-motion`.  
**Imported by:** `src/pages/Home.jsx`.

---

#### `src/components/WeatherCard.jsx`

**Purpose:** A dashboard widget displaying the current temperature, weather condition, and daily min/max for the user's geolocation. Falls back to Kolkata coordinates (22.5726, 88.3639) if geolocation is unavailable or denied.

**External APIs called:**
- `https://api.bigdatacloud.net/data/reverse-geocode-client` — reverse geocoding (lat/lon → city name)
- `https://api.open-meteo.com/v1/forecast` — temperature and WMO weather codes

**State managed:**

| State | Type | Purpose |
|---|---|---|
| `weatherData` | `{city, currentTemp, minTemp, maxTemp, desc, Icon}` | Fetched and derived weather data |
| `loading` | `boolean` | Shows spinner while fetching |
| `error` | `string \| null` | Shows error state on failure |

**Helper:** `getWeatherDetails(code)` — maps WMO weather codes to a description string and a Lucide icon component.

**Refresh:** `setInterval` auto-refreshes every 15 minutes.

**Key exports:** Default `WeatherCard` function component.  
**Imports from:** `react`, `lucide-react`.  
**Imported by:** `src/pages/Home.jsx`.

---

### `src/components/ui/` — Primitive UI Components

Atomic, reusable components styled with TailwindCSS and class-variance-authority.

---

#### `src/components/ui/button.jsx`

**Purpose:** A polymorphic `Button` component built with `class-variance-authority` (CVA) and `@radix-ui/react-slot`. Supports variant and size props and forwards refs.

**Props:**

| Prop | Type | Default | Values |
|---|---|---|---|
| `variant` | `string` | `"default"` | `default`, `destructive`, `outline`, `secondary`, `ghost`, `link` |
| `size` | `string` | `"default"` | `default`, `sm`, `lg`, `icon` |
| `asChild` | `boolean` | `false` | If `true`, renders as the child element via Radix `<Slot>` |
| `className` | `string` | — | Merged with CVA classes via `cn()` |
| `ref` | `React.Ref` | — | Forwarded to the underlying element |

**Key exports:** `Button` (default export), `buttonVariants` (CVA instance, for external class composition).  
**Imports from:** `@radix-ui/react-slot`, `class-variance-authority`, `react`, `../../lib/utils`.  
**Imported by:** `src/pages/Landing.jsx`.

---

#### `src/components/ui/dialog.tsx`

**Purpose:** A styled dialog (modal) wrapper built on top of `@radix-ui/react-dialog`. Exports all composable Radix dialog parts re-styled with Tailwind.

> **Note:** This is the only TypeScript file in the frontend. It was likely scaffolded by Shadcn UI. Direct usage in the page components is not confirmed from source inspection — it may be unused at runtime or used indirectly.

**Key exports:** `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose`, `DialogTrigger`, `DialogOverlay`, `DialogPortal`.  
**Imports from:** `react`, `@radix-ui/react-dialog`, `lucide-react`, `../../lib/utils`.

---

### `src/lib/` — Utilities

#### `src/lib/utils.js`

**Purpose:** Single utility function `cn()` that merges Tailwind class names safely. Used by all CVA-based UI components.

**Key exports:**

```js
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
```

`clsx` handles conditional and array class inputs; `tailwind-merge` resolves Tailwind conflicts (e.g. `p-4 p-6` → `p-6`).

**Imports from:** `clsx`, `tailwind-merge`.  
**Imported by:** `src/components/ui/button.jsx`, `src/components/ui/dialog.tsx`.

---

### Test Files

#### `frontend/e2e-test.spec.js`

**Purpose:** Full end-to-end Playwright test covering the complete user journey. Creates two isolated browser contexts (simulating two users), signs each up and in, has both join the same room (`test-room`), enables camera and mic, verifies that both have 2 video elements, tests sending a chat message (verifies User 2 sees it), and tests saving a note.

**Browser flags used:** `--use-fake-ui-for-media-stream`, `--use-fake-device-for-media-stream` (avoids needing a real camera/mic on CI).

**Assertions:**
- Both pages have exactly 2 `<video>` elements after connection
- User 2 sees User 1's chat message

**Imports from:** `@playwright/test`.

---

#### `frontend/join_call.spec.js`

**Purpose:** Playwright test focused on the join-call flow (entering a room code and confirming join). *(File not read in full — ~97 lines.)*

---

#### `frontend/multi_join.spec.js`

**Purpose:** Playwright test for multi-user join scenarios. *(File not read in full — ~190 lines.)*

---

## Backend

The backend is a Django 6 project configured for ASGI with Django Channels. It lives in `hangout/backend/`.

---

### `core/` — Project Configuration

The Django project package. Contains global settings, URL routing, and the ASGI/WSGI entry points.

---

#### `backend/manage.py`

**Purpose:** Django's standard CLI management utility. Entry point for `runserver`, `migrate`, `createsuperuser`, etc.  
**Key operation:** Sets `DJANGO_SETTINGS_MODULE = "core.settings"` and calls `execute_from_command_line(sys.argv)`.  
**Imports from:** `django.core.management`.

---

#### `backend/requirements.txt`

**Purpose:** Lists Python package dependencies. Currently lists three packages:
- `channels==4.3.2`
- `Django==6.0.6`
- `djangorestframework==3.17.1`

> **Note:** `django-cors-headers` and `daphne` are used in `settings.py` (`INSTALLED_APPS`) but are absent from `requirements.txt`. Install them manually.

---

#### `core/settings.py`

**Purpose:** Master Django configuration file. All application-level settings live here.

**Key settings:**

| Setting | Value | Notes |
|---|---|---|
| `INSTALLED_APPS` | `daphne`, standard Django apps, `rest_framework`, `users`, `corsheaders`, `channels`, `meetings` | `daphne` must be first to take over `runserver` with ASGI support |
| `ASGI_APPLICATION` | `"core.asgi.application"` | Routes all traffic through the ASGI stack |
| `CHANNEL_LAYERS` | `InMemoryChannelLayer` | In-process only; not suitable for multi-worker/multi-server |
| `CORS_ALLOW_ALL_ORIGINS` | `True` | Allows all origins in development |
| `DATABASES` | SQLite at `BASE_DIR / "db.sqlite3"` | Default; no configuration required |
| `MEDIA_URL` | `"/media/"` | URL prefix for uploaded files |
| `MEDIA_ROOT` | `os.path.join(BASE_DIR, "media")` | Filesystem root for uploads |
| `SECRET_KEY` | Hardcoded string | **Must be replaced in production** |
| `DEBUG` | `True` | **Must be `False` in production** |

**Imports from:** `pathlib`, `os`.  
**Imported by:** All Django internals; referenced by `asgi.py` and `wsgi.py` via env var.

---

#### `core/urls.py`

**Purpose:** Root HTTP URL router. Delegates to the `users` app URLs under `/api/` and directly maps all meeting REST endpoints.

**URL patterns:**

| Pattern | View | Name |
|---|---|---|
| `admin/` | Django admin | — |
| `api/` (include) | `users.urls` | — |
| `api/recordings/upload/` | `meeting_views.upload_recording` | `upload_recording` |
| `api/recordings/<str:username>/` | `meeting_views.get_user_recordings` | `get_user_recordings` |
| `api/recordings/delete/<int:recording_id>/` | `meeting_views.delete_recording` | `delete_recording` |
| `api/notes/save/` | `meeting_views.save_note` | `save_note` |
| `api/notes/<str:username>/` | `meeting_views.get_user_notes` | `get_user_notes` |
| `api/notes/delete/<int:note_id>/` | `meeting_views.delete_note` | `delete_note` |

Also appends `static(MEDIA_URL, document_root=MEDIA_ROOT)` in `DEBUG` mode so uploaded recordings are served directly by Django during development.

**Imports from:** `django.contrib.admin`, `django.urls`, `meetings.views`, `django.conf`, `django.conf.urls.static`.

---

#### `core/asgi.py`

**Purpose:** ASGI application entry point. Uses Django Channels' `ProtocolTypeRouter` to dispatch:
- `http` traffic → standard Django request/response stack (`get_asgi_application()`)
- `websocket` traffic → `AuthMiddlewareStack(URLRouter(meetings.routing.websocket_urlpatterns))`

This single file is what enables Hangout to handle both REST API calls and WebSocket connections on the same port.

**Key exports:** `application` (the ASGI callable consumed by Daphne).  
**Imports from:** `os`, `django.core.asgi`, `channels.routing`, `channels.auth`, `meetings.routing`.

---

#### `core/wsgi.py`

**Purpose:** Legacy WSGI entry point. Not used in production (Daphne runs ASGI), but kept for compatibility (e.g. some deployment platforms).  
**Key exports:** `application` (WSGI callable).  
**Imports from:** `os`, `django.core.wsgi`.

---

### `users/` — Authentication App

Handles user registration, authentication, and brute-force protection.

---

#### `users/models.py`

**Purpose:** Defines two models: `SignupUser` (basic profile mirror) and `LoginAttempt` (tracks failed sign-in attempts for lockout).

See [SCHEMA.md](./SCHEMA.md#login_attempt-usersmodelspy) for full field documentation.

**Key exports:** `SignupUser`, `LoginAttempt` model classes.  
**Imports from:** `django.db.models`.

---

#### `users/serializers.py`

**Purpose:** DRF `ModelSerializer` for Django's `AUTH_USER`. Exposes `username`, `email`, `password` fields. Sets `password` as `write_only`. Overrides `create()` to use `User.objects.create_user()` (which hashes the password correctly).

> **Note:** This serializer is defined but not directly invoked by the current `views.py` — the view manually calls `User.objects.create_user()`. The serializer may be used in future or was part of an earlier iteration.

**Key exports:** `UserSerializer` class.  
**Imports from:** `django.contrib.auth.models.User`, `rest_framework.serializers`.

---

#### `users/views.py`

**Purpose:** Two DRF `@api_view` functions for user authentication.

**`signup(request)` — `POST /api/signup/`:**
- Validates that `username` is not already taken.
- Calls `User.objects.create_user(username, email, password)`.
- Returns `201` on success, `400` if username exists.

**`signin(request)` — `POST /api/signin/`:**
- Gets or creates a `LoginAttempt` record for the given username.
- Checks if account is locked (returns `429` with `lockout_seconds_remaining`).
- Calls Django's `authenticate()`. If username auth fails, attempts lookup by email.
- On success: resets `failed_attempts` to 0, returns `200 {message, username}`.
- On failure: increments `failed_attempts`, applies progressive lockout (1/10/30 min), returns `401` or `429`.

**Key exports:** `signup`, `signin` view functions.  
**Imports from:** `django.contrib.auth.models.User`, `django.contrib.auth.authenticate`, `rest_framework`, `django.utils.timezone`, `datetime.timedelta`, `.models.LoginAttempt`.

---

#### `users/urls.py`

**Purpose:** URL patterns for the users app. Mounted under `/api/` in `core/urls.py`.

| Pattern | View |
|---|---|
| `signup/` | `views.signup` |
| `signin/` | `views.signin` |

**Imports from:** `django.urls.path`, `.views`.

---

#### `users/admin.py`

**Purpose:** Registers `SignupUser` in the Django admin panel.  
**Imports from:** `django.contrib.admin`, `.models.SignupUser`.

---

#### `users/apps.py`

**Purpose:** Django app configuration class `UsersConfig`. Sets `default_auto_field` and `name = "users"`.

---

### `meetings/` — Rooms, Signaling & Media App

Handles WebRTC signaling (WebSocket), recording uploads, note management, and the Room model.

---

#### `meetings/models.py`

**Purpose:** Defines the `Room`, `MeetingRecording`, and `MeetingNote` models.

See [SCHEMA.md](./SCHEMA.md) for full field documentation.

**Key helper:** `fifteen_days_from_now()` — a module-level function (not a method) used as the `default` for `MeetingRecording.expires_at`. Django requires callables for dynamic defaults.

**Key exports:** `Room`, `MeetingRecording`, `MeetingNote` model classes.  
**Imports from:** `django.db.models`, `django.contrib.auth.models.User`, `django.utils.timezone`, `datetime.timedelta`.

---

#### `meetings/views.py`

**Purpose:** Six REST API view functions for recording and note CRUD. All views are decorated with `@csrf_exempt` where they accept non-GET requests (since the frontend sends requests without a CSRF token).

**`upload_recording(request)` — `POST /api/recordings/upload/`:**
- Accepts `multipart/form-data` with `video_file`, `room_id`, `username`.
- Looks up `AUTH_USER` by username; calls `Room.get_or_create(room_id=room_uuid)`.
- Creates `MeetingRecording(user, room, video_file)`.

**`get_user_recordings(request, username)` — `GET /api/recordings/<username>/`:**
- Purges expired recordings first (deletes file + row).
- Returns JSON array sorted by `-created_at` with `days_remaining` calculated.

**`delete_recording(request, recording_id)` — `DELETE /api/recordings/delete/<id>/`:**
- Deletes the file from disk (`video_file.delete(save=False)`) then the DB row.

**`save_note(request)` — `POST /api/notes/save/`:**
- Parses JSON body `{room_id, username, content}`.
- Calls `Room.get_or_create`; creates `MeetingNote`.

**`get_user_notes(request, username)` — `GET /api/notes/<username>/`:**
- Returns all notes for a user, sorted by `-created_at`.

**`delete_note(request, note_id)` — `DELETE /api/notes/delete/<id>/`:**
- Deletes the note row.

**Key exports:** Six view functions.  
**Imports from:** `django.contrib.auth.models.User`, `.models.MeetingRecording, Room, MeetingNote`, `json`, `django.http.JsonResponse`, `django.views.decorators.csrf.csrf_exempt`, `django.utils.timezone`.

---

#### `meetings/consumers.py`

**Purpose:** The WebSocket signaling server. A single `AsyncWebsocketConsumer` class that handles all real-time WebRTC coordination.

**Class: `CallConsumer(AsyncWebsocketConsumer)`**

| Method | Trigger | Description |
|---|---|---|
| `connect()` | WebSocket handshake | Extracts `room_id` from URL, adds channel to the room group, accepts the connection. Sets `self.username = "Someone"` initially. |
| `disconnect(close_code)` | WebSocket close | Broadcasts `{type:"user-left", username: self.username}` to the room group, then removes channel from group. |
| `receive(text_data)` | Incoming WS message | Parses JSON. Caches `self.username` when a `"ready"` packet arrives. Extracts `target` field. Calls `group_send` with the message, `sender_channel`, `sender_username`, and `target_user`. |
| `signal_message(event)` | Channel layer group broadcast | Called for each message broadcast to the group. **Echo filter:** drops if `self.channel_name == sender_channel`. **Target filter:** drops if `target_user` is set and `target_user != self.username`. Forwards all other messages to the WebSocket client. |

**Key design:** The consumer is **stateless with respect to SDP/ICE** — it relays all JSON payloads without inspecting them. The `target` field in the payload allows the consumer to implement unicast delivery within a group broadcast model.

**Key exports:** `CallConsumer` class.  
**Imports from:** `json`, `channels.generic.websocket.AsyncWebsocketConsumer`.

---

#### `meetings/routing.py`

**Purpose:** Declares the WebSocket URL patterns consumed by `core/asgi.py`.

**Pattern:** `ws/call/<room_id>/` → `CallConsumer.as_asgi()`

The regex `[\w-]+` allows alphanumeric characters and hyphens in room IDs.

**Key exports:** `websocket_urlpatterns` list.  
**Imports from:** `django.urls.re_path`, `.consumers.CallConsumer`.

---

#### `meetings/admin.py`

**Purpose:** Django admin registration (currently empty — only the default `# Register your models here.` comment; none of the meetings models are registered in admin).

---

#### `meetings/apps.py`

**Purpose:** Django app configuration class `MeetingsConfig`. Sets `default_auto_field` and `name = "meetings"`.
