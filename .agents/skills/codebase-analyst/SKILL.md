---
name: codebase-analyst
description: Analyze an existing web application to understand its architecture, routes, APIs, database, and user workflows.
---

# Codebase Analyst

## Objective

Understand the existing KINO Laundry POS project
before making any code changes.

## Workflow

1. Inspect the project folder structure.
2. Identify frontend and backend technologies.
3. Find application entry points and routes.
4. Map all pages and navigation.
5. Trace frontend requests to backend APIs.
6. Identify PostgreSQL tables and queries.
7. Analyze authentication and user roles.
8. Trace laundry transactions and payments.
9. Trace shift management and reports.
10. Identify incomplete features and possible bugs.

## Documentation

Create or update:

- docs/ARCHITECTURE.md
- docs/FEATURE_MAP.md
- docs/USER_FLOWS.md

For each feature, reference its actual source files.

## Rules

- Do not modify application code.
- Do not modify database schemas.
- Do not invent functionality.
- Mark unverified findings clearly.
- Explain results in Indonesian.
- Ask for approval before implementing changes.