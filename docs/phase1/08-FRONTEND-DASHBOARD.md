# Phase 1 — Frontend Dashboard Specification

> **Document Purpose**: Define every page, component, interaction, state management pattern, and visual design requirement for the Next.js frontend. An AI coding agent should be able to implement the complete frontend from this document alone.

---

## 1. Why This Frontend Exists

CogniTwin's value is only realized when insights are **visible and actionable**. The backend computes predictions, generates SQL answers, and processes data — but without a well-designed frontend, none of this reaches the user.

### Design Philosophy

1. **Dashboard-first**: The user lands on a dashboard with KPIs and charts. They should get value within 5 seconds of opening the app.
2. **Upload is a gateway**: Data upload is prominent but not the landing page. If seed data exists, the dashboard is immediately useful.
3. **Progressive disclosure**: Show summary → details on demand. Don't overwhelm with data tables.
4. **AI as conversation**: The Q&A interface is a chat, not a form. This feels natural and encourages exploration.
5. **Dark mode by default**: Modern, professional appearance. Reduces eye strain for long sessions.

---

## 2. Visual Design System

### Color Palette

```css
/* Primary Colors */
--color-bg-primary: #0F1117;        /* Deep dark background */
--color-bg-secondary: #1A1D2E;      /* Card/panel background */
--color-bg-tertiary: #232738;        /* Hover states, input backgrounds */

/* Accent Colors */
--color-accent-primary: #6C63FF;     /* Primary action, active elements */
--color-accent-secondary: #4ECDC4;   /* Success, positive metrics */
--color-accent-warning: #FFD93D;     /* Warnings, attention */
--color-accent-danger: #FF6B6B;      /* Errors, negative metrics */
--color-accent-info: #45B7D1;        /* Informational elements */

/* Text Colors */
--color-text-primary: #F0F0F0;       /* Primary text */
--color-text-secondary: #8B8FA3;     /* Secondary/muted text */
--color-text-tertiary: #5A5F7A;      /* Disabled text */

/* Chart Colors (ordered palette for data series) */
--chart-color-1: #6C63FF;
--chart-color-2: #4ECDC4;
--chart-color-3: #FFD93D;
--chart-color-4: #FF6B6B;
--chart-color-5: #45B7D1;
--chart-color-6: #F093FB;
--chart-color-7: #96E6A1;

/* Borders and Surfaces */
--color-border: rgba(255, 255, 255, 0.08);
--color-surface-glass: rgba(255, 255, 255, 0.03);
--color-shadow: rgba(0, 0, 0, 0.3);
```

### Typography

Use **Inter** from Google Fonts (loaded via `next/font`).

```css
--font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-size-xs: 0.75rem;    /* 12px — labels, badges */
--font-size-sm: 0.875rem;   /* 14px — secondary text, table cells */
--font-size-base: 1rem;     /* 16px — body text */
--font-size-lg: 1.125rem;   /* 18px — card titles */
--font-size-xl: 1.5rem;     /* 24px — page titles */
--font-size-2xl: 2rem;      /* 32px — hero metrics */
--font-size-3xl: 2.5rem;    /* 40px — large dashboard numbers */

--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;
```

### Spacing

```css
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.5rem;    /* 24px */
--space-6: 2rem;      /* 32px */
--space-8: 3rem;      /* 48px */
```

### Border Radius

```css
--radius-sm: 6px;
--radius-md: 10px;
--radius-lg: 16px;
--radius-xl: 24px;
--radius-full: 9999px;
```

### Glassmorphism Card Style

All cards use a subtle glassmorphism effect:

```css
.card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: 0 4px 24px var(--color-shadow);
  backdrop-filter: blur(10px);
}
```

### Micro-Animations

```css
/* Standard transition for interactive elements */
--transition-fast: 150ms ease;
--transition-base: 250ms ease;
--transition-slow: 400ms ease;

/* Hover lift effect for cards */
.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(108, 99, 255, 0.15);
  transition: var(--transition-base);
}

/* Pulse animation for loading states */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Fade-in for page transitions */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
```

---

## 3. Layout Structure

### App Shell

```
┌───────────────────────────────────────────────────────────┐
│                     HEADER BAR                            │
│  [Logo] CogniTwin AI                    [Health Status]   │
├──────────┬────────────────────────────────────────────────┤
│          │                                                │
│ SIDEBAR  │              CONTENT AREA                      │
│          │                                                │
│ Dashboard│     (Page-specific content rendered here)      │
│ Upload   │                                                │
│ Forecast │                                                │
│ Ask AI   │                                                │
│          │                                                │
│          │                                                │
│          │                                                │
│          │                                                │
├──────────┴────────────────────────────────────────────────┤
```

### Sidebar

- Width: 240px (collapsed: 64px with icons only)
- Position: Fixed left
- Background: `var(--color-bg-primary)`
- Border right: `1px solid var(--color-border)`
- Navigation items:
  1. **Dashboard** (icon: LayoutDashboard) — `/dashboard`
  2. **Upload Data** (icon: Upload) — `/upload`
  3. **Forecast** (icon: TrendingUp) — `/forecast`
  4. **Ask AI** (icon: MessageCircle) — `/query`
- Active item: Background `var(--color-accent-primary)` at 15% opacity, left border accent

### Header

- Height: 60px
- Background: `var(--color-bg-primary)`
- Border bottom: `1px solid var(--color-border)`
- Left: CogniTwin AI logo/text
- Right: System health indicator (green dot = healthy, yellow = degraded, red = error)

### Icons

Use **Lucide React** icon library. It's lightweight, tree-shakeable, and has consistent design.

---

## 4. Page Specifications

### 4.1 Dashboard Page (`/dashboard`)

**Purpose**: The primary view. Shows KPIs, sales trends, and data status at a glance.

**Layout**:
```
┌─────────────────────────────────────────────────────────┐
│  Dashboard                              [Date Range ▼]   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │Total Rev │ │  Orders  │ │ Avg Order│ │Customers │   │
│  │₹4,52,000 │ │  1,250   │ │  ₹361    │ │   89     │   │
│  │ +12% ▲   │ │ +8% ▲    │ │ +3% ▲    │ │ -2% ▼    │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Sales Trend Chart                    │   │
│  │          (Line chart - daily revenue)             │   │
│  │                                                   │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────┐ ┌─────────────────────────┐   │
│  │   Top 5 Products     │ │  Payment Distribution   │   │
│  │   (Bar chart)        │ │  (Donut chart)          │   │
│  └──────────────────────┘ └─────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Data Status Cards                    │   │
│  │  Sales: 4,380 ✓  Products: 25 ✓  Inventory: 25 ✓│   │
│  │  Customers: 50 ✓  Suppliers: 10 ✓               │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Components used:**
- `MetricCard` × 4 — KPI cards with value, trend arrow, percentage change
- `SalesChart` — Recharts LineChart with date on X-axis, revenue on Y-axis
- `TopProductsChart` — Recharts BarChart horizontal
- Payment distribution — Recharts PieChart/DonutChart
- `DataStatusCards` — Shows count of records per entity type

**Data fetching:**
- Call `GET /api/v1/data/summary` with the selected date range
- Date range default: last 30 days
- Date range selector: dropdown with options: Last 7 days, Last 30 days, Last 90 days, Last 12 months, All time

**Empty state (no data uploaded yet):**
- MetricCards show `₹0` with dashes instead of trend
- Charts show empty state illustration with text: "Upload your sales data to see insights"
- Prominent "Upload Data" button centered in the content area
- Data status cards show "No data" for each entity type with upload links

**MetricCard behavior:**
- Shows current period value
- Shows percentage change vs previous period (if previous period data exists)
- Green arrow up for positive change, red arrow down for negative
- Animate the number counting up on load (using CSS counter animation or `framer-motion`)

---

### 4.2 Upload Page (`/upload`)

**Purpose**: Upload CSV files for any business entity type.

**Layout**:
```
┌─────────────────────────────────────────────────────────┐
│  Upload Data                                             │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Select data type:                                       │
│  ┌────────────────────────────────────────────────────┐  │
│  │ [Sales] [Products] [Customers] [Inventory] [Suppl] │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │                                                    │  │
│  │            ┌──────────────────────┐                │  │
│  │            │    📁  Drop CSV     │                │  │
│  │            │    file here or     │                │  │
│  │            │    click to browse  │                │  │
│  │            └──────────────────────┘                │  │
│  │                                                    │  │
│  │  Accepted: .csv files up to 50MB                  │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Upload History                                    │  │
│  │  ┌──────────────────────────────────────────────┐  │  │
│  │  │ sales_2024.csv  │ Sales │ 4,380 rows │ ✓    │  │  │
│  │  │ products.csv    │ Prod  │   25 rows  │ ✓    │  │  │
│  │  │ bad_file.csv    │ Sales │    0 rows  │ ✗    │  │  │
│  │  └──────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Components used:**
- `EntityTypeSelector` — Pill/tab buttons to select entity type
- `FileDropzone` — Drag-and-drop area with visual feedback
- `UploadProgress` — Progress bar during upload (indeterminate since processing time varies)
- `UploadResult` — Post-upload summary card showing rows ingested, warnings, column mapping
- Upload history table — Fetched from `GET /api/v1/data/uploads`

**Upload flow (step by step):**
1. User selects entity type (default: Sales)
2. User drops a CSV file or clicks to browse
3. `FileDropzone` validates file extension client-side (`.csv` only)
4. `FileDropzone` validates file size client-side (≤ 50MB)
5. If validation fails, show error inline (red text below dropzone)
6. If validation passes, show `UploadProgress` component
7. Send `POST /api/v1/upload/{entity_type}` with the file
8. On success (201): show `UploadResult` component with:
   - Green check icon
   - "4,380 rows uploaded successfully"
   - Expandable "3 warnings" section listing each warning
   - Expandable "Column Mapping" section showing CSV → schema mapping
   - "View Data" button linking to dashboard
9. On error: show `ErrorAlert` with the error message from the API
10. Refresh upload history table

**Drag-and-drop states:**
- Default: Dashed border, icon, text
- Drag over: Border becomes solid accent color, background lightens, scale up slightly
- File selected: Shows filename and size
- Uploading: Pulse animation, progress bar
- Success: Green border, check icon
- Error: Red border, error icon

---

### 4.3 Forecast Page (`/forecast`)

**Purpose**: Train forecasting models and visualize predictions.

**Layout**:
```
┌─────────────────────────────────────────────────────────┐
│  Sales Forecast                                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Model Status: ✓ Trained (Dec 15, 2024)            │  │
│  │ Data: 365 daily points | Last: Dec 31, 2024       │  │
│  │                                                    │  │
│  │ Horizon: [30 days ▼]  Granularity: [Daily ▼]     │  │
│  │                                                    │  │
│  │ [Train New Model]  [Refresh Predictions]          │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │                                                    │  │
│  │              Forecast Chart                        │  │
│  │                                                    │  │
│  │  ──── Actual (solid blue line)                     │  │
│  │  ---- Predicted (dashed purple line)               │  │
│  │  ░░░░ Confidence Band (shaded purple area)         │  │
│  │                                                    │  │
│  │  [Date axis spanning history + forecast horizon]   │  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Forecast Summary                                  │  │
│  │  Next 7 days: ₹1,05,000 (predicted)              │  │
│  │  Next 30 days: ₹4,20,000 (predicted)             │  │
│  │  Trend: ▲ Increasing (+5% vs last 30 days)       │  │
│  └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Components used:**
- `ForecastStatus` — Shows model training status and metadata
- `ForecastControls` — Horizon selector (30/60/90 days), granularity selector, action buttons
- `ForecastChart` — Recharts ComposedChart with:
  - `Line` for actual historical data (solid, `--chart-color-1`)
  - `Line` for predicted data (dashed, `--chart-color-2`)
  - `Area` for confidence interval (semi-transparent fill between lower and upper bounds)
  - The historical and predicted lines should connect seamlessly at the boundary
- Forecast summary — Key prediction metrics in cards

**States:**
1. **No sales data**: "Upload sales data first to enable forecasting" with link to upload page
2. **Sales data exists, no model**: "Train a model to generate forecasts" with "Train Model" button
3. **Training in progress**: Loading spinner with "Training model..." text
4. **Model ready**: Full chart and controls visible
5. **Training failed**: Error message with retry button

**"Train New Model" button behavior:**
- Click → Confirm dialog: "This will retrain the model with current data. Continue?"
- On confirm → Show loading state → `POST /api/v1/forecast/train`
- On success → Refresh chart with new predictions
- On error → Show error alert

---

### 4.4 Ask AI Page (`/query`)

**Purpose**: Natural language Q&A interface.

**Layout**:
```
┌─────────────────────────────────────────────────────────┐
│  Ask AI                                                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │              Chat Message Area                     │  │
│  │                                                    │  │
│  │  ┌─ AI ────────────────────────────────────────┐   │  │
│  │  │ Welcome! I can answer questions about your  │   │  │
│  │  │ business data. Try asking:                  │   │  │
│  │  │ • "What were total sales last month?"       │   │  │
│  │  │ • "Which product sells the most?"           │   │  │
│  │  │ • "How many customers do we have?"          │   │  │
│  │  └─────────────────────────────────────────────┘   │  │
│  │                                                    │  │
│  │  ┌─ You ───────────────────────────────────────┐   │  │
│  │  │ What were the total sales last month?       │   │  │
│  │  └─────────────────────────────────────────────┘   │  │
│  │                                                    │  │
│  │  ┌─ AI ────────────────────────────────────────┐   │  │
│  │  │ Total sales last month were **₹4,52,000**   │   │  │
│  │  │ across **1,250 transactions**. This is a    │   │  │
│  │  │ 12% increase compared to the previous month.│   │  │
│  │  │                                             │   │  │
│  │  │ [▼ View SQL Query]                          │   │  │
│  │  └─────────────────────────────────────────────┘   │  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │ [Ask a question about your business data...]  [➤] │  │
│  └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Components used:**
- `ChatInterface` — Container managing message list and scroll
- `ChatMessage` — Individual message bubble (user or AI)
- `SQLDisplay` — Collapsible section showing the generated SQL query
- `QueryInput` — Text input with send button

**ChatMessage (AI response) features:**
- Markdown rendering (bold, lists, code)
- Collapsible SQL display (collapsed by default, click to expand)
- Timestamp in small text
- Fade-in animation when appearing

**Chat behavior:**
- Messages are stored in React state (not persisted, lost on page reload — this is acceptable for Phase 1)
- On send:
  1. Add user message to chat
  2. Add AI "thinking" placeholder (three dots animation)
  3. `POST /api/v1/query` with the question
  4. On success: Replace placeholder with formatted answer
  5. On error: Replace placeholder with error message styled as AI response
- Auto-scroll to bottom on new message
- Press Enter to send, Shift+Enter for new line
- Disable send button while waiting for response
- Suggested questions chips shown initially and after each answer (3 random suggestions)

**Suggested question chips:**
```
"What were total sales last month?"
"Which product sells the most?"
"How many customers do we have?"
"What is the average order value?"
"Which payment method is most popular?"
"Show sales by category"
"What is the total inventory value?"
"Which supplier has the best rating?"
```

---

## 5. State Management

### Approach: React Server Components + Client Hooks

- **Server Components**: Used for layout, static content, initial data fetch
- **Client Components**: Used for interactive elements (forms, charts, chat)
- **State**: Managed with `useState` and `useReducer` at the page level. No global state library (Redux, Zustand) needed in Phase 1.
- **Data Fetching**: Custom hooks using `fetch` with the centralized API client.

### Custom Hooks

#### `useSummary(dateFrom?, dateTo?)`
- Fetches `GET /api/v1/data/summary`
- Returns: `{ data, isLoading, error, refetch }`

#### `useUpload(entityType)`
- Manages file upload state
- Returns: `{ upload(file), isUploading, result, error, reset }`
- Handles: file validation, API call, result/error state

#### `useSalesData(pagination, filters)`
- Fetches `GET /api/v1/data/sales`
- Returns: `{ data, pagination, isLoading, error }`
- Auto-refetches when pagination or filters change

#### `useForecast(horizon, includeHistory)`
- Fetches `GET /api/v1/forecast/predict`
- Returns: `{ data, isLoading, error }`

#### `useQuery()`
- Manages chat state and query submission
- Returns: `{ messages, sendQuery(question), isQuerying, error }`
- Each message: `{ id, role: 'user' | 'ai', content, sql?, timestamp }`

---

## 6. API Client (`lib/api.ts`)

### Design

A centralized fetch wrapper:

```typescript
// Conceptual interface (not exact code)
const api = {
  get<T>(path: string, params?: Record<string, string>): Promise<T>
  post<T>(path: string, body?: unknown): Promise<T>
  upload<T>(path: string, file: File): Promise<T>
}
```

### Responsibilities
- Prepend base URL (`NEXT_PUBLIC_API_URL` env var, default: `http://localhost:8000/api/v1`)
- Set Content-Type header
- Parse JSON response
- Extract `data` from success envelope
- Throw typed errors from error envelope
- Handle network errors
- Log request/response for debugging

### Error Handling

Define a custom `ApiError` class:
```typescript
class ApiError extends Error {
  type: string       // e.g., "VALIDATION_ERROR"
  statusCode: number // e.g., 400
  details: unknown[] // Additional error details
}
```

All API methods throw `ApiError` on non-2xx responses. Components catch these in the hooks and display appropriate error UI.

---

## 7. Responsive Design

### Breakpoints

```css
/* Mobile first approach */
--breakpoint-sm: 640px;    /* Small tablets */
--breakpoint-md: 768px;    /* Tablets */
--breakpoint-lg: 1024px;   /* Small laptops */
--breakpoint-xl: 1280px;   /* Desktops */
```

### Responsive Behavior

| Element | Desktop (≥1024px) | Tablet (768-1023px) | Mobile (<768px) |
|---|---|---|---|
| Sidebar | Fixed, 240px wide | Collapsible overlay | Bottom navigation bar |
| MetricCards | 4 columns | 2 columns | 1 column (stacked) |
| Charts | Full width within content | Full width | Full width, reduced height |
| Data tables | Full columns visible | Horizontal scroll | Horizontal scroll |
| Chat interface | Full width with padding | Full width | Full width, full height |

---

## 8. Component Specifications

### `MetricCard`

**Props:**
```typescript
{
  title: string           // e.g., "Total Revenue"
  value: string           // e.g., "₹4,52,000"
  change: number | null   // e.g., 12.5 (percentage), null if no comparison
  changeLabel?: string    // e.g., "vs last month"
  icon: LucideIcon        // e.g., IndianRupee, ShoppingCart
  accentColor?: string    // CSS variable for the icon/accent color
}
```

**Visual:**
- Card with glassmorphism background
- Icon in top-left with accent color circle background
- Large value text (font-size-2xl, font-weight-bold)
- Percentage change with colored arrow (green up, red down)
- Hover: lift effect with subtle shadow

### `DataTable`

**Props:**
```typescript
{
  columns: { key: string; label: string; sortable: boolean; format?: 'currency' | 'date' | 'number' }[]
  data: Record<string, unknown>[]
  pagination: { page: number; pageSize: number; totalCount: number }
  onPageChange: (page: number) => void
  onSort: (column: string, order: 'asc' | 'desc') => void
  isLoading: boolean
}
```

**Visual:**
- Styled table within a card
- Header row with sort indicators
- Alternating row backgrounds (subtle)
- Pagination controls at bottom (Previous / Page X of Y / Next)
- Loading state: skeleton rows
- Empty state: "No data found" centered text

---

## 9. Loading and Error States

### Loading States

Every data-dependent component must handle loading:
- `MetricCard`: Skeleton shimmer (pulsing gray rectangles)
- Charts: Skeleton rectangle with pulse animation
- Tables: 5 skeleton rows
- Chat: Three-dot typing indicator

### Error States

Every API call must handle errors:
- Network error: "Unable to connect to server. Please check if the backend is running."
- 400 errors: Show the error message from the API
- 500 errors: "Something went wrong. Please try again."
- 503 errors: "Service temporarily unavailable. Please try again in a few moments."

Error UI: `ErrorAlert` component with red accent border, error icon, message text, and optional retry button.

---

## 10. Environment Variables

```env
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

This is the ONLY frontend environment variable in Phase 1. No API keys in the frontend.
