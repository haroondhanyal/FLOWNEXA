# FlowNexa Web Automation

Playwright automation for the FlowNexa web app. The suite is split by purpose so the web team can own screens, APIs, user journeys, and release gates independently.

## Folder map

```text
automation/
├── config/                 # URLs, browser settings, Playwright and Allure options
├── data/                   # Screen inventory, route contract cases, responsive matrices
├── fixtures/               # Test fixtures and one-time test-account login
├── locators/               # Shared, centralized selectors for all app screens
├── pages/                  # Login, app shell, and workspace page objects
├── utils/                  # Faker data, date helpers, and API helper
├── tests/
│   ├── api/                 # API authorization contracts
│   ├── db/                  # Read-only PostgreSQL health/model checks
│   ├── integration/         # API→DB and web→DB persistence checks
│   ├── ui/                  # Screen-by-screen, viewport-based UI checks
│   ├── bdd/                 # Given/When/Then workflow journeys
│   ├── smoke/               # Quick release/startup suite
│   ├── regression/          # Stable workspace shell and screen invariants
│   └── negative/            # Invalid form input and API/auth edge cases
├── reporter/                # Combined report hub and performance report pages
├── tests/k6/                # 120 named, read-only API performance cases
└── scripts/                 # Allure history, report assembly, and cleanup
```

The latest complete run discovered and passed 961 Playwright cases: 190 API contract checks, 279 UI checks, 150 BDD journeys, 120 smoke checks, 120 regression checks, 70 negative checks, 30 database checks, and 2 API/web-to-database integration checks. This is a run snapshot, not a hard-coded suite size; `npm run test:list` reports the current count. The cases execute browser interactions, API requests, and database queries against the configured test environment. API auth contracts exercise protected-route rejection and don't replace valid authenticated CRUD/API business-flow coverage.

## Setup

```bash
cd web-app/automation
cp .env.example .env
npm install
npx playwright install chromium
```

Set `WEB_BASE_URL` and `API_BASE_URL`. For workspace screen suites, use a **dedicated test account** in `TEST_EMAIL` and `TEST_PASSWORD`; optionally set `TEST_ORGANIZATION_ID` and `TEST_WORKSPACE_ID`. Never use a production account. Without credentials, authenticated suites are skipped while public login-validation checks still run.

The app and API must be running. To let Playwright launch the local Next.js web server, set `PW_START_WEB_SERVER=true`. It does not start the API or database.

## Commands

```bash
npm run test:list       # enumerate all Playwright cases without executing them
npm test                # complete suite
npm run test:api        # API authorization contracts
npm run test:ui         # responsive screen checks
npm run test:bdd        # user workflow journeys
npm run test:smoke      # quick app readiness checks
npm run test:regression # workspace screen invariants
npm run test:negative   # client-side validation cases
npm run test:db          # PostgreSQL model and health checks and linked reports
npm run test:db:all      # DB, API→DB and web→DB cases in one report
npm run seed:db:40       # create 40 clearly tagged Faker tasks in the local/test project
npm run test:integration # API and web persistence integration cases
npm run test:api-db      # API writes verified against PostgreSQL
npm run test:ui-db       # workspace form writes verified against PostgreSQL
npm run test:headed      # headed browser run
npm run report:allure   # generate the classic Allure 2 dashboard after a run
npm run report:db       # regenerate the database statistics/evidence report
npm run report:open     # open the Allure report
npm run report:k6       # run 120 k6 cases and assemble linked Allure + performance reports
npm run clean           # remove generated reports and test artifacts
```

## Test data and safety

- `@faker-js/faker` creates unique names and realistic date values; `utils/dates.ts` provides native date-input helpers.
- The session token is written to `.auth/session.json` with private file permissions and excluded from Git.
- Every Playwright case captures a screenshot and video for Allure, including successful cases; traces remain available on failures. Shared `beforeEach`/`afterEach` hooks collect browser exceptions and attach a full-page failure screenshot to Allure.
- UI cases record navigation, viewport changes, and browser actions such as clicks, fills, selections, and key presses as named Allure steps. API cases attach request and response details with credential values redacted.
- Keep mutation tests on a disposable local/test organization. Avoid parallel runs against a shared staging account when creating tasks or invitations.

## Allure report

The report uses the classic Allure 2 dashboard with a fixed FlowNexa header, logo, and saved color-theme selector, plus the standard left navigation for Categories, Suites, Graphs, Timeline, Behaviors, and Packages. Its Overview includes run trends and the Playwright executor/build details. Java 8 or newer is required by the Allure 2 CLI. The report builder removes a stale JAVA_HOME and uses Java from PATH. Previous report history is copied before a run so later reports can show trends.

### Failure categories

Allure Categories group failed, broken, skipped, and unknown results by root cause or run state. The source of truth is [config/allure/categories.json](config/allure/categories.json): it defines Product Defects, Automation / Test Defects, API / Integration Issues, Environment / Infrastructure Issues, Test Data Issues, Timeout / Performance Issues, Known Issues, and Skipped / Pending. The rules cover UI, API, database, and other backend tests because classification uses each result's failure message, stack trace, and Allure status rather than the test type.

npm test keeps the existing Playwright run and then builds the Allure site even when tests fail. Before report generation, [scripts/setup-allure-categories.js](scripts/setup-allure-categories.js) copies the JSON rules into allure-results/categories.json. npm run report:allure also performs this setup whenever a report is built separately. The setup script uses Node's filesystem APIs, so the copy works on Windows, macOS, and Linux.

The Categories page adds an eight-color summary, case distribution chart, recent failed/skipped table, and category list while retaining Allure's standard navigation. The report postprocessor explicitly places skipped/unknown results in Skipped / Pending and timeout failures in Timeout / Performance Issues; this keeps a single skipped DB case visible even when Allure's native category tree omits skipped results. Select a category to expand its cases, then select a case to open its error, stack trace, captured before/after hooks, recorded Playwright steps, and attachments below that case. Categories with no matching cases remain visible with a zero count.

Each category has a name, matchedStatuses, and optional Java regular-expression fields. matchedStatuses selects Allure result states such as failed, broken, skipped, and unknown. messageRegex is matched against the failure message; traceRegex is matched against its stack trace. Allure's native matcher uses Java regex syntax. The report postprocessor uses JavaScript regex for its skipped/timeout fallback mapping and removes a leading `(?s)` flag; keep patterns in the shared syntax supported by both engines and escape backslashes in JSON strings. Rules are evaluated in file order: put specific causes before broader rules to avoid capturing failures too early.

To add a category, add an object to config/allure/categories.json with a clear name, statuses, and a focused messageRegex and/or traceRegex. Keep the category's display order and color entry in scripts/customize-allure-report.mjs in sync. Run npm run report:allure to regenerate the report from existing results, or npm test to execute the suite and build a fresh report. For example, (?s).*(ECONNREFUSED|server unavailable).* classifies network and service outages across test types.

The Allure header links to `report-home.html` and `performance-report.html`. Both pages link back to Allure, and the performance page links to `native-k6-report.html`. `npm run report:allure` assembles these pages with the FlowNexa logo into the generated report folder. Light, dark, gray, blue, green, and violet options change only the header colors. The Overview environment details include the FlowNexa project description, owner, department, role, environment and test coverage. Test results are grouped into feature areas for API, UI, BDD journeys, smoke, regression, negative, database, and integration coverage. Categories, executor details and historical trends are retained in the Allure report. See the [web app guide](../README.md) for report screenshots and the complete walkthrough.

## k6 performance cases

The k6 suite contains 120 named cases distributed over authenticated, read-only API routes. Each case runs once at up to 120 concurrent virtual users and checks for a successful response under 1.5 seconds. It does not create or modify application data. Install the Grafana k6 CLI (or Docker for the fallback), start the API, and configure a dedicated test account before running it:

```bash
cd web-app/automation
export API_BASE_URL=http://localhost:4000/api/v1
export TEST_ORGANIZATION_ID=your-test-organization-id
export K6_ACCESS_TOKEN=your-test-account-access-token
npm run report:k6
npm run report:open
```

`report:k6` records the raw k6 summary and generates a per-case performance page and standalone k6 HTML graph report, then rebuilds Allure and assembles the linked report site. The latest k6 data is kept under ignored `artifacts/k6/`; do not use production credentials or run the 120-user profile against production.

Generated reports and `.auth` state are ignored by Git. Commit the source config, helpers, and test cases; publish generated reports separately as CI artifacts.

## Database and integration automation

The existing Playwright framework runs DB checks from `tests/db` and cross-layer checks from `tests/integration`; it reuses the existing fixtures, session setup, screenshots, videos, traces, and Allure results. Prisma access imports FlowNexa's generated client from the API workspace and validates models that exist in `database/prisma/schema.prisma` (including User, Organization, Workspace, Project, Task, Comment, Notification, and AuditLog). It does not create an alternate framework or assume fields/routes absent from the application.

Read-only checks cover PostgreSQL connectivity and queryability of core model tables. API→DB and web→DB cases create a uniquely marked task through the existing app route/UI, compare persisted values and task audit rows, and remove only the exact generated task by its captured ID and unique title. Mutations are opt-in: set `DB_MUTATION_TESTS=true` and `DB_ENVIRONMENT=qa` (or `test`, `dev`, `development`, or `local`) for a disposable non-production database. Mutations refuse an environment labeled production. Never configure these checks with a production database. The automation package reuses `web-app/.env`'s `DATABASE_URL` if `automation/.env` does not set one; credentials stay in environment files and are never included in report evidence.

`npm run report:db` generates `db-report/index.html` and sanitized `db-report/db-results.json`. It includes total/passed/failed/skipped counts, pass rate, source coverage, duration, and expandable per-case expected/actual values and errors. The Allure report home links to the DB report, which is also copied into the generated combined site as `db-report.html`. Structured `database-validation.json` attachments remain available in each Allure test case. Email, password/hash, token, phone, cookie, authorization, and free-text body/content fields are masked in evidence.

The 30 DB cases (`DB-001`–`DB-030`) cover connectivity, seeded-record count, queryability for all 25 Prisma models, primary-key presence, and core organization/project/task references. The 2 cross-layer integration cases verify API-to-DB and web-to-DB task persistence and audit history; they are isolated mutations and require `DB_MUTATION_TESTS=true`. DB-focused commands generate the Allure site after their run, while `npm test` includes DB and integration suites in its complete Playwright run and builds both report views. A DB outage appears as a failed connectivity check with a report entry; it does not silently count as a pass. `npm run seed:db:40` creates 40 Faker-generated tasks in the dedicated test organization/project, tags every title with a unique `FNQA_FAKER_40_<run>` marker, and verifies the inserted count. Seed records are intentionally retained for inspection; use the marker in `artifacts/db/faker-seed.json` to identify them. The DB suite includes a seeded-count assertion when that seed artifact is present.
