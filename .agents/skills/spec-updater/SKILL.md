---
name: spec-updater
description: Use this skill when asked to update spec.md (or product specification documents) to incorporate recent architecture, database, API, serialization, or feature changes.
---

# Specification Document (spec.md) Updater Guide

When requested to update `spec.md` with recent code or architectural changes, follow this protocol to keep the project specification accurate, structured, and synchronized.

---

## 1. Workflow Protocol

1. **Inspect Target File (`spec.md`):**
   - Read the existing `spec.md` file using `view_file` to understand the current section structure (e.g. `## 1. Product Vision`, `## 2. Core Features`, `## 4. Technical Specification`).

2. **Identify Impacted Sections:**
   - **Backend / Architecture Changes:** Update Section 4.2 (`Backend Design`) or 4.4 (`API Design Guidelines`).
   - **Frontend / UI Changes:** Update Section 2 (`Core Features`) or Section 4.3 (`Frontend Design`).
   - **Database & Model Changes:** Update Section 4.2 (`Data Access`, `Data Model & Partitioning`, `Serialization & Persistence Rules`).
   - **Testing Infrastructure:** Update Section 4.2 or 4.3 (`Testing`).

3. **Format Changes Consistently:**
   - Preserve existing headings and section numbers.
   - Use standard markdown bullet points with concise, professional explanations.
   - Detail concrete technical choices (e.g., class names, framework attributes, method invocations like `Database.EnsureCreatedAsync()`, `JsonStringEnumConverter`, `.HasConversion<string>()`).

4. **Verify File Accuracy:**
   - Ensure no existing historical requirements or feature bullet points are accidentally deleted unless explicitly requested.

---

## 2. Standard Spec Section Reference

- **4.1 Architecture Overview:** High-level framework and stack components.
- **4.2 Backend Design (.NET + Azure Functions):** Services, repositories, DbContext configuration, startup initialization (`Database.EnsureCreatedAsync()`), JSON serialization converters, and testing projects (`backend.Tests`).
- **4.3 Frontend Design (React + Vite):** Components, custom hooks, state management, and styling systems.
- **4.4 API Design Guidelines:** HTTP endpoints, route parameters, request payload formats, and status codes.
