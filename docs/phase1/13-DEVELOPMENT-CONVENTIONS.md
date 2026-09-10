# Phase 1 — Development Conventions and Anti-Patterns

> **Document Purpose**: Define coding standards, naming rules, architectural patterns, and explicit anti-patterns that AI coding agents must follow or avoid. This document prevents stylistic drift and architectural violations across all Phase 1 code.

---

## 1. Python Conventions (Backend)

### Code Style

- **Formatter**: Ruff (configured in `pyproject.toml`)
- **Line length**: 100 characters maximum
- **Quotes**: Double quotes for strings (`"hello"`, not `'hello'`)
- **Imports**: Sorted by Ruff (standard library → third-party → local)
- **Type hints**: Required on ALL function signatures (parameters and return types)
- **Docstrings**: Required on ALL public classes and functions. Use Google style.

### Type Hint Rules

```python
# ✅ Correct — full type hints
async def get_sales(
    self,
    pagination: PaginationParams,
    date_range: DateRange | None = None,
) -> PaginatedResult[Sale]:

# ❌ Wrong — missing return type, missing parameter types
async def get_sales(self, pagination, date_range=None):
```

### Docstring Rules

```python
# ✅ Correct — Google style, describes behavior
async def process_upload(
    self,
    file_stream: BinaryIO,
    entity_type: EntityType,
) -> IngestionResult:
    """Process a CSV file upload and persist cleaned data.

    Parses the CSV, maps columns to the target schema, cleans data,
    validates rows, and persists valid records to the database.

    Args:
        file_stream: Binary stream of the uploaded CSV file.
        entity_type: The business entity type (sales, products, etc.).

    Returns:
        IngestionResult with row counts, warnings, and errors.

    Raises:
        FileValidationError: If the file is not a valid CSV.
        SchemaMapError: If required columns cannot be mapped.
    """
```

### Function Length

- Maximum 40 lines per function body (excluding docstring).
- If a function exceeds 40 lines, extract helper functions.
- Each function should do ONE thing.

### Class Design

- Prefer composition over inheritance.
- Use `typing.Protocol` for interfaces, NOT `abc.ABC`.
- Constructor parameters are the ONLY way to inject dependencies. No module-level singletons.
- No class methods for alternative constructors in domain entities (use factory functions instead).

### Async/Await

- ALL database operations use `async/await`.
- ALL Gemini API calls use `async/await`.
- File I/O (CSV parsing) is synchronous (pandas is not async). Use `run_in_executor` if it becomes a bottleneck (unlikely in Phase 1).
- Service methods are `async` if they call any async infrastructure.

---

## 2. TypeScript Conventions (Frontend)

### Code Style

- **Formatter**: Prettier (configured in `.prettierrc`)
- **Linter**: ESLint with Next.js defaults
- **Semicolons**: Yes
- **Quotes**: Single quotes for strings (`'hello'`)
- **Indentation**: 2 spaces

### Component Rules

```tsx
// ✅ Correct — named export, typed props, destructured
interface MetricCardProps {
  title: string;
  value: string;
  change: number | null;
  icon: LucideIcon;
}

export function MetricCard({ title, value, change, icon: Icon }: MetricCardProps) {
  return (
    <div className="metric-card">
      ...
    </div>
  );
}

// ❌ Wrong — default export, no interface, inline types
export default function MetricCard(props: { title: string }) { ... }
```

### Rules

1. **Named exports only**. No `export default` except for Next.js page components (required by Next.js).
2. **Props interface**: Every component has an explicit `Props` interface defined above the component.
3. **No `any` type**: Use `unknown` if the type is truly unknown, then narrow with type guards.
4. **No inline styles**: Use CSS classes from `globals.css`. Exception: dynamic values computed at runtime (e.g., chart dimensions).
5. **No `useEffect` for data fetching**: Use custom hooks that encapsulate the fetch logic.
6. **Null checks before rendering**: Always handle `null`, `undefined`, `loading`, and `error` states.

### File Organization Within Components

```tsx
// 1. Imports (React, libraries, components, types, utilities)
// 2. Types/Interfaces
// 3. Constants (if any)
// 4. Component function
// 5. Helper functions (if any, prefer extracting to utils)
```

### CSS Rules

- Use CSS custom properties (variables) defined in `globals.css` for ALL colors, spacing, typography, and border-radius.
- Class names use `kebab-case`: `.metric-card`, `.chart-container`, `.upload-dropzone`.
- BEM naming for component-specific styles: `.chat-message`, `.chat-message--user`, `.chat-message--ai`.
- No CSS-in-JS. No styled-components. No Tailwind. Pure CSS.
- Each page/component can have a co-located CSS module (`Component.module.css`) for component-specific styles, or use global classes.

---

## 3. API Development Conventions

### Endpoint Implementation Pattern

Every endpoint follows this exact structure:

```python
# In the router file
@router.post("/{entity_type}", response_model=SuccessResponse[UploadResponseData], status_code=201)
async def upload_csv(
    entity_type: EntityType,
    file: UploadFile,
    service: IngestionService = Depends(get_ingestion_service),
) -> SuccessResponse[UploadResponseData]:
    """Upload a CSV file for the given entity type."""
    result = await service.process_upload(file.file, entity_type)
    return SuccessResponse(
        status="success",
        data=UploadResponseData.from_ingestion_result(result),
    )
```

**Pattern elements:**
1. **Type-annotated parameters** — FastAPI validates automatically
2. **Service injected via `Depends()`** — never constructed in the handler
3. **Handler calls ONE service method** — no multi-step logic in handlers
4. **Returns typed response model** — no raw dicts
5. **No try/except** — global handler catches everything

### Request Validation

- Use Pydantic models for request bodies.
- Use `Path()`, `Query()` for path/query parameter validation with descriptions.
- Use `Enum` for constrained string values (entity_type, sort_order).

### Response Model Convention

```python
# Generic success wrapper
class SuccessResponse(BaseModel, Generic[T]):
    status: Literal["success"] = "success"
    data: T
    meta: dict | None = None

# Specific data model
class UploadResponseData(BaseModel):
    upload_id: str
    filename: str
    entity_type: str
    rows_ingested: int
    rows_skipped: int
    warnings: list[str]
    column_mapping: dict[str, str]
```

---

## 4. Database Conventions

### Query Rules

1. **Never write raw SQL in services.** All queries go through the Repository.
2. **Exception**: `execute_readonly_sql()` in the repository accepts raw SQL for LLM-generated queries. This is the ONLY place raw SQL is allowed.
3. **Use ORM for all application queries.** Raw SQL is only for the LLM query flow.
4. **Always use parameterized queries.** Never use f-strings or string concatenation for SQL.

### Transaction Rules

1. Services do NOT manage transactions directly.
2. The session middleware (or `Depends(get_session)`) provides a session per request.
3. The session auto-commits on successful response.
4. The session rolls back on exception.

### Migration Rules

1. NEVER modify the database schema outside of Alembic migrations.
2. Every schema change requires a new migration file.
3. Migrations must be reversible (implement `downgrade()`).
4. Test migrations on a fresh database: `alembic downgrade base && alembic upgrade head`.

---

## 5. Error Handling Conventions

### In Domain Layer

- Raise domain exceptions (`CogniTwinError` subclasses) for business rule violations.
- Exception messages should be user-facing (clear, non-technical English).
- Include relevant context in the exception (what went wrong, what was expected).

```python
# ✅ Correct
raise InsufficientDataError(
    f"Sales forecasting requires at least {MIN_DATA_POINTS} data points. "
    f"Current data has {actual_count} data points."
)

# ❌ Wrong — technical, unhelpful
raise InsufficientDataError("len(df) < 30")
```

### In Infrastructure Layer

- Catch framework-specific exceptions and wrap in domain exceptions.
- NEVER let SQLAlchemy, Prophet, or Gemini exceptions leak to the service layer.

```python
# ✅ Correct
try:
    result = await session.execute(stmt)
except asyncpg.exceptions.ConnectionDoesNotExistError as e:
    raise ExternalServiceError(f"Database connection failed: {e}") from e

# ❌ Wrong — SQLAlchemy leaks to service layer
result = await session.execute(stmt)  # raises raw SQLAlchemy error
```

### In Service Layer

- Only catch exceptions if you can recover (retry, fallback).
- If you cannot recover, let the exception propagate to the global handler.

### In API Layer

- NEVER use try/except in route handlers (unless you need to transform the response in a handler-specific way).
- The global exception handler handles everything.

---

## 6. Anti-Patterns — What Must NEVER Be Done

### Architecture Anti-Patterns

| Anti-Pattern | Why It's Wrong | Correct Approach |
|---|---|---|
| Router imports SQLAlchemy | Violates layer separation | Router → Service → Repository |
| Service imports concrete infrastructure | Tight coupling | Service depends on Protocol interface |
| Domain entity has SQLAlchemy columns | Domain is polluted with framework | Separate ORM models from domain entities |
| Global state / module-level singletons | Untestable, unreproducible | Constructor injection via Depends() |
| Business logic in route handler | Untestable, not reusable | Move to service layer |
| Database query in a Pydantic model | Mixing validation with data access | Keep models pure data containers |

### Code Anti-Patterns

| Anti-Pattern | Why It's Wrong | Correct Approach |
|---|---|---|
| `except: pass` | Silently swallows all errors | Catch specific exceptions, log them |
| `except Exception as e: print(e)` | Not structured logging | Use `logger.error()` with context |
| `import *` | Pollutes namespace, hides dependencies | Explicit imports |
| Hardcoded connection strings | Not configurable | Use Settings from config.py |
| Hardcoded file paths | Breaks in Docker | Use Settings.ML_MODELS_DIR, etc. |
| `time.sleep()` in production code | Blocks the async event loop | Use `asyncio.sleep()` if needed |
| Mutable default arguments | Python gotcha (shared state) | Use `None` default, assign in body |
| Storing secrets in code/commits | Security violation | Use environment variables |

### Frontend Anti-Patterns

| Anti-Pattern | Why It's Wrong | Correct Approach |
|---|---|---|
| Direct `fetch()` calls in components | No centralized error handling | Use `lib/api.ts` |
| State in global variables | Not React-idiomatic | Use useState/useReducer/hooks |
| Inline styles everywhere | Inconsistent, unmaintainable | Use CSS classes and variables |
| No loading states | Bad UX | Every async operation has a loading state |
| No error handling | Crashes on API failure | Every hook handles error state |
| `console.log()` in production | Pollutes browser console | Use conditional logging |
| Ignoring TypeScript errors (`@ts-ignore`) | Defeats type safety | Fix the type error |

---

## 7. Git Conventions

### Commit Messages

Format: `type(scope): description`

Types:
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code restructuring without behavior change
- `test`: Adding or modifying tests
- `docs`: Documentation changes
- `chore`: Build, config, dependency changes
- `style`: Formatting, no code change

Examples:
```
feat(ingestion): add fuzzy column matching for CSV uploads
fix(forecast): clamp negative prediction values to zero
test(query): add tests for SQL validation edge cases
docs(api): update endpoint documentation with rate limits
chore(docker): add health check to backend container
```

### Branch Naming

- `main`: Production-ready code
- `feat/{description}`: Feature branches
- `fix/{description}`: Bug fix branches

---

## 8. Documentation Conventions

### Code Comments

- Use comments to explain **WHY**, not **WHAT**.
- The code itself should be readable enough to explain what it does.

```python
# ✅ Good — explains WHY
# Use multiplicative seasonality because retail seasonal effects
# scale proportionally with trend (e.g., Diwali spike grows as base sales grow)
seasonality_mode="multiplicative"

# ❌ Bad — explains WHAT (obvious from code)
# Set seasonality mode to multiplicative
seasonality_mode="multiplicative"
```

### README.md

The root `README.md` must contain:
1. Project name and one-line description
2. Quick start instructions (docker-compose up)
3. Tech stack summary
4. Project structure overview
5. Environment variable setup
6. Link to full documentation (docs/phase1/)

---

## 9. Security Conventions

1. **No secrets in code**: API keys, database passwords, and all credentials come from environment variables.
2. **No secrets in git**: `.env` files are in `.gitignore`. Only `.env.example` is committed.
3. **Read-only for LLM SQL**: All LLM-generated SQL executes with `cognitwin_readonly` role.
4. **Validate all inputs**: File uploads, query parameters, request bodies — all validated via Pydantic or explicit checks.
5. **Sanitize all outputs**: Error messages never include stack traces, connection strings, or file system paths.
6. **CORS restricted**: Only allow frontend origin, not `*`.

---

## 10. Dependency Management

### Adding New Dependencies

Before adding any new Python or npm package:
1. Verify it's actively maintained (last commit within 6 months)
2. Verify it doesn't duplicate existing functionality
3. Prefer standard library solutions when available
4. Add to `pyproject.toml` or `package.json` with a minimum version constraint

### Version Pinning

- Use minimum version constraints (`>=1.0.0`) in `pyproject.toml`, not exact pins (`==1.0.0`).
- Use `package-lock.json` for reproducible frontend builds.
- Lock files are committed to git.
