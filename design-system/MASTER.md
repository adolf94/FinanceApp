# Master UI/UX Design System

**Project:** Personal Finance App
**Stack:** React + Tailwind CSS + Shadcn
**Aesthetic:** Clean, Professional, Compact Mobile-First

## 1. Visual Identity
- **Primary:** `bg-blue-600` / `text-blue-600` - Trustworthy financial blue.
- **Background (Dark Mode):** `bg-slate-950`
- **Surface (Dark Mode):** `bg-slate-900`
- **Background (Light Mode):** `bg-slate-50`
- **Surface (Light Mode):** `bg-white`
- **Typography:** `text-slate-900` (Light) / `text-slate-50` (Dark). Muted text uses `text-slate-500`.
- **Status Colors:** `text-emerald-500` for Income, `text-rose-500` for Expenses.

## 2. Layout & Architecture (Responsive Mobile-First)
- **Container / Desktop Scaling:** 
  - **Mobile:** Full width `w-full`.
  - **Desktop/Tablet:** Expand to a wider container (e.g., `max-w-5xl`) utilizing a Master-Detail or 2-column layout. Treat desktop as "two mobile screens side-by-side" (e.g., Transaction list on the left pane, details/charts on the right pane).
- **Navigation:**
  - **Mobile:** Bottom Navigation Bar (`fixed bottom-0 w-full`), containing 4-5 core tabs, plus a FAB (Floating Action Button) at `bottom-20 right-4`.
  - **Desktop:** Bottom Navigation shifts to a Sidebar/Side-rail, and FAB actions integrate into pane headers.
- **Compact Density:**
  - Transaction lists use reduced padding (`p-3`) to maximize vertical space.
  - Remove unnecessary borders in lists; use subtle dividers (`divide-y divide-slate-200 dark:divide-slate-800`).

## 3. Typography Rules
- **Font Family:** `Inter` for all text.
- **Sizing:**
  - `text-xs` (12px) for timestamps and secondary labels.
  - `text-sm` (14px) for list item descriptions.
  - `text-base` (16px) for primary list items.
  - `text-2xl` (24px) for prominent balances.

## 4. Interaction & UX
- **Touch Targets:** All clickable elements (buttons, list rows) MUST have a minimum height of `44px` (`min-h-[44px]`).
- **Feedback:** Use `hover:bg-slate-100 dark:hover:bg-slate-800` and `active:scale-95 transition-all` on interactive elements.
- **Cursor:** Ensure `cursor-pointer` is applied to all interactive cards and rows.
- **Gestures:** Horizontal scrolling for category pills (`overflow-x-auto snap-x`).

## 5. Anti-Patterns to Avoid (ui-ux-pro-max rules)
- **No Emojis:** Use Lucide React icons for all visual indicators.
- **Avoid Heavy Modals:** Use bottom sheets (drawers) instead of center-screen modals for form entry on mobile.
- **Avoid Layout Shifts:** Ensure hover states only change colors/opacities (e.g. `transition-colors duration-200`), not dimensions.
- **Contrast:** Ensure glass/transparent elements are visible in light mode (minimum `bg-white/80`).
