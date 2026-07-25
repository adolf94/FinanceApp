# Product Specification Document: Personal Finance App

## 1. Product Vision & Objective
**Objective:** Create a mobile-first personal finance application that allows users to seamlessly track income, expenses, and account balances, functioning as a robust personal accounting tool. The focus is strictly on historical tracking of transactions rather than forward-looking budgeting.

**Target Audience:** Individuals seeking a clear, organized, and accessible way to manage their daily financial transactions and monitor their overall financial health.

**Design Philosophy:** Mobile-first approach, prioritizing quick data entry and easily digestible financial overviews.

## 2. Core Features & Requirements

### 2.1. Account Management
Users need a structured way to mirror their real-world financial accounts within the app.
- **Account Groups (Categories):** Custom groups (e.g., "Cash," "Bank Accounts," "Credit Cards," "Investments"). System provides defaults. Note: "Expense" and "Income" types are excluded from manual group creation in the main Accounts UI, as they function as dynamic tracking categories rather than persistent running-balance accounts. They are managed instead via the Settings tab.
- **Accounts (Specific Entities):** Added under groups. Fields include: Name, Group, Starting Balance, Currency. For Credit Cards, fields also include `CreditCardCycleStartDay` and `CreditCardPaymentDueDay`.
- **Actions:** CRUD operations, view balances, and drill-down to Account History View.
- **Settings Tab (Configuration):** A dedicated configuration area designed to strictly separate structural financial accounts from tracking meta-data. It features:
  - **Categories Management:** CRUD management for `Expense` and `Income` groups (Categories) and their nested accounts (Sub-Categories).
  - **Vendor Management:** Dedicated UI to view, create, and delete Vendors.

### 2.2. Transaction Management
- **Transaction Modes:**
  - **Simple Mode:** Streamlined UI for common Income, Expense, and Transfers. Generates standard dual-entry ledgers automatically.
  - **Advanced Mode (Journal):** Full double-entry accounting view supporting multiple splits and manual debit/credit allocation.
- **Transaction Types:** Expense, Income, Transfer, Journal.
- **Categorization:** Two-level (Primary Group > Specific Selection).
- **Fields:** Type, Amount, Date, Account (From/To for transfers), Category Group, Specific Selection, Note, Vendor.
- **Inline Creation & Search (Combobox):** The Category, Sub-Category, and Vendor selection fields utilize a custom `Combobox` component. This enables searchable dropdowns and allows users to seamlessly create new categories, sub-categories, or vendors inline directly during the Add Transaction flow without navigating away.

### 2.3. Recurring Transactions
- Automates data entry (Daily, Weekly, Monthly, Yearly).
- Supports configuring `maxOccurrences` to automatically stop generation after a fixed number of transactions.
- Uses `RecurringTransaction` entity featuring document embedding in Cosmos DB (nesting `templateEntries` and `occurrences` directly in the document).
- Handled efficiently in the background via a nightly Azure Functions `[TimerTrigger]`. 
- Provides an automated view under the Transactions page, showcasing the scheduled history and expected end dates.

### 2.4. Data Entry & Automation
- **Smart Categorization:** Learns from manual entries to suggest categories based on past transaction vectors using cosine-similarity retrieval.
- **Automated Data Capture via Notification Ingester:** A dedicated Python Azure Functions microservice (`notif-ingester/`) handles incoming phone notifications and auto-creates pending transactions:
  1. **Receive:** A mobile notification payload is `POST`ed to `/phone_hook` and saved to the `PhoneHookMessages` CosmosDB container with `status = "received"`.
  2. **Classify:** A Cosmos DB Change Feed trigger fires, embeds the raw notification text using Gemini `text-embedding-004`, retrieves top-3 similar past transactions via cosine similarity, then sends the full context (notification + similar transactions + RUNBOOK.md rules) to Gemini for structured classification into a `PendingIngestion` document (`status = "Pending"`).
  3. **Confirm:** The user reviews the AI suggestion and confirms via `POST /ingestions/{id}/confirm`, which creates the final transaction in the main Finance API and marks the ingestion as `Committed`.

### 2.5. Monthly Transaction List View
- Chronological log of financial activity for a calendar month, accessed via the **Daily tab** (default) inside the Transactions page.
- Grouped by date with sticky date headers. Each row shows: Type Icon (color-coded), Account/Description, Vendor, Note (italic), and Amount.
- **Edit/Delete:** Each transaction row exposes an inline Pencil (edit) and Trash (delete) action. Tapping the pencil opens `AddTransactionModal` pre-filled with the transaction's data.

### 2.6. Monthly Calendar Overview
- Accessed via the **Month tab** inside the Transactions page (alongside the **Daily tab**, which is the default chronological list).
- Displays a 7-column calendar grid (Sun–Sat) for the selected month.
- **Per-day cells** show: daily total income (green chip), daily total expense (red chip), and net (blue/amber).
- **Month summary bar** at the top of the grid shows the month-level totals for Income, Expenses, and Net.
- **Income/Expense computation is account-type driven** (applies to all transaction types including Journal entries):
  - An entry is counted as **Income** when its linked account has `AccountType = Income` and `amount < 0` (credit to income account).
  - An entry is counted as **Expense** when its linked account has `AccountType = Expense` and `amount > 0` (debit to expense account).
  - Net = Total Income − Total Expense.
- Tapping a day with transactions opens a **Day Transaction Modal** (bottom sheet) showing:
  - Day totals summary (Income / Expense / Net chips).
  - Scrollable list of all transactions for that day with the same visual style as the Daily tab.
  - Closes on X button or backdrop tap.

### 2.7. Specific History Views (Drill-Downs)
- **Account History:** Transactions tied to a specific account with a running balance. For Credit Cards, standard chronological daily groupings are further segmented with visual Statement Cycle boundaries based on the `CreditCardCycleStartDay` (e.g. "STATEMENT: JUL 15 - AUG 14").
- **Category History:** Transactions tied to a specific primary group or specific selection.

### 2.8. Analysis & Insights
- **Goal Tracking:** Track progress towards savings goals.
- **Visualizations:** Charts/graphs for spending by category and cash flow (e.g., Recharts).
- **Dynamic Context:** Includes a month ticker to dynamically filter and calculate spending charts and cash flow based on the specifically selected month.

## 3. Non-Functional Requirements
- **UI:** Touch-friendly, large tap targets. Follows "OLED-First" branding guidelines.
- **Dark Mode:** System-level and manual toggle.
- **Performance:** Instantaneous loading.

## 4. Technical Specification

### 4.1 Architecture Overview
- **Frontend:** React + Vite (SPA)
- **Backend:** Azure Functions (.NET 9) — primary CRUD API
- **Notification Ingester:** Azure Functions (Python) — AI-powered notification-to-transaction pipeline
- **Database:** CosmosDB (NoSQL)
- **Communication:** REST API via Axios
- **Currency:** Philippine Peso (`₱`). All monetary values displayed and stored in PHP.
- **ID Generation:** Always use `uuidv7` for generating new GUIDs/UUIDs to ensure time-sortable primary keys across the application (both .NET using `UuidExtensions` and Python using `uuid_extensions`).

### 4.2 Backend Design (.NET + Azure Functions)
- **Layered Structure:** Controller/Function Layer (entry point) -> Service Layer (business logic) -> Repository Layer (data access logic).
- **Interface Pattern:** All business logic and data access hidden behind interfaces (ITransactionService, ITransactionRepository, IVendorService, ICategoryService) for DI and unit testing.
- **Data Access:** Entity Framework Core for CosmosDB.
- **Containers & Partitioning:**
  - `AccountGroups` (`/UserId`) — Categories and financial groups (`AccountType`: `Expense`, `Income`, `Asset`, `Liability`, `Equity`, `Adjustment`, `Cash`, `Bank`, `CreditCard`, `Investment`).
  - `Accounts` (`/UserId`) — Subcategories and individual account entities belonging to an `AccountGroup` (`AccountGroupId`). Supports `CreditCardCycleStartDay` and `CreditCardPaymentDueDay` for billing cycle tracking.
  - `Transactions` (`/UserId`) — Shared container storing both `Transaction` and `LedgerEntry` documents, differentiated by an EF Core Discriminator.
    - `Transaction` acts as the root header document.
    - `LedgerEntry` acts as the individual line items. Due to EF Core Cosmos provider limitations on non-embedded relationships, entries are fetched manually in the Repository (bypassing `.Include()`) and mapped via composite foreign keys (`TransactionId`, `UserId`).
  - `Vendors` (`/UserId`) — Standalone vendor entity container for tracking and dropdown selection.
- **Database Initialization:** Invokes `Database.EnsureCreatedAsync()` during application startup in `Program.cs` to ensure target database and containers are automatically created.
- **Serialization & Persistence Rules:** 
  - Enums (`AccountType`, `TransactionType`) are decorated with `[JsonConverter(typeof(JsonStringEnumConverter))]` and processed with custom `JsonSerializerOptions` to support string enum values in HTTP JSON payloads.
  - EF Core model configuration uses `.HasConversion<string>()` in `FinanceDbContext` to store enums as human-readable string values in Cosmos DB documents.
- **Transaction Updates:** To maintain double-entry accounting integrity, updating a transaction explicitly removes existing `LedgerEntry` child records and inserts replacements, seamlessly reversing and reapplying account balance impacts atomically.
- **Testing:** `backend.Tests` xUnit project utilizing `Moq` for unit testing service business logic and `System.Text.Json` model serialization.

### 4.3 Frontend Design (React + Vite)
- **Data Fetching:** Axios instance with interceptors for authentication (OAuth) and global error handling. State management via `@tanstack/react-query` for caching and synchronization.
- **Routing:** `@tanstack/router` for type-safe navigation.
- **Development Standard:** No direct fetch. All network requests MUST go through the configured Axios instance. Logic and UI separated. Hooks used for data retrieval using React Query.
- **Testing:** Vitest and React Testing Library utilized for verifying React Query custom hooks (`useTransactions`, etc.) and component interactions via mocked API clients.
- **Key Components:**
  - `Settings.tsx` (`pages/`) — Tabbed configuration area for manual management of Categories (Expense/Income groups) and Vendors, keeping the main Accounts view decluttered.
  - `Combobox.tsx` (`components/ui/`) — Reusable, searchable dropdown component that supports inline creation. Embedded throughout the Transaction Modal for fast data entry.
  - `Transactions.tsx` — Monthly transaction page. Houses a **Daily | Month** tab switcher. The Daily tab renders the existing chronological list; the Month tab renders `CalendarView`.
  - `CalendarView.tsx` (`pages/`) — 42-cell (6×7) calendar grid. Accepts `transactions[]` and `accounts[]` as props (already fetched by the parent). Computes per-day income/expense summaries using the account-type driven rule (see §2.6). Opens `DayModal` on day tap.
  - `DayModal.tsx` (`components/`) — Bottom-sheet modal displaying day-level Income/Expense/Net summary chips and a scrollable transaction list for the selected date.
- **Account Interface (`useAccounts.ts`):** The `Account.accountType` field uses the full enum union matching the backend: `'Cash' | 'Bank' | 'CreditCard' | 'Investment' | 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense' | 'Adjustment'`. This is required for the calendar to identify income/expense accounts during per-day aggregation.

### 4.4 API Design Guidelines
- **Version:** API v1.
- **Authentication:** OAuth via `@adolf94/ar-auth-client`.
- **Error Handling:** Consistent response envelopes for all errors.

### 4.5 Notification Ingester (Python Azure Functions)
- **Language & Runtime:** Python 3.11+, Azure Functions v2 programming model (`azure-functions`).
- **Dependency Injection:** Manual factory functions (`get_hook_service()`, `get_ingestion_service()`) compose services in `function_app.py`.
- **Service Layer:**
  - `HookService` — Validates and persists incoming `PhoneHookMessage` to CosmosDB.
  - `EmbeddingService` — Calls Google Gemini `text-embedding-004` to produce a 768-dimension float vector from notification text.
  - `VectorService` — Performs cosine-similarity search (via `numpy`) across all stored `TransactionVector` documents for a user to retrieve top-k matches.
  - `AiService` — Sends the notification, similar transactions, and RUNBOOK.md rules to Gemini for structured JSON classification (`AiParsedData`: vendor, amount, type, debit/credit account IDs, category, confidence).
  - `FinanceApiService` — Calls the main .NET Finance API to create confirmed transactions.
  - `IngestionService` — Orchestrates the full pipeline: embed → retrieve → classify → store `PendingIngestion`.
- **Key Models (Pydantic):**
  - `PhoneHookMessage` — Raw notification payload (`action`, `raw_msg`, `status`, `month_key`, `partition_key`). Includes a `_ttl` of 60 days for auto-expiry.
  - `PendingIngestion` — AI classification result document with `AiParsedData`, `top_matches`, `similarity_score`, `status` (`Pending` → `Committed`/`Rejected`).
  - `TransactionVector` — Persisted embedding document used for future similarity lookups.
- **CosmosDB Containers:**
  - `PhoneHookMessages` (`/partition_key`) — Raw incoming hook documents with Change Feed trigger and lease container.
  - `PendingIngestions` (`/partition_key`) — AI-classified transaction proposals awaiting user confirmation.
  - `TransactionVectors` (`/userId`) — Historical embeddings indexed for similarity retrieval.
- **RUNBOOK.md:** A human-editable markdown file read at classification time. Defines explicit vendor→category→type overrides that take precedence over AI inference.
- **API Key Auth:** All HTTP endpoints require `x-api-key` header matching the `API_KEY` environment variable.
