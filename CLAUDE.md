@AGENTS.md
# CLAUDE.md

## Project

* Build production-quality code, not demos.
* Prioritize maintainability, scalability, and readability.
* Prefer incremental improvements over rewrites.

## Architecture

* Keep UI independent of data sources.
* UI → Repository → Service → External API/Storage.
* Repositories expose domain models only.
* Keep mapping/parsing out of UI components.
* Design for easy migration from JSON to APIs/Supabase.

## Code

* Use TypeScript strict typing; avoid `any`.
* Keep components and functions focused.
* Reuse existing code before creating new abstractions.
* Prefer composition over inheritance.
* Minimize dependencies.
* Follow existing project conventions.

## Next.js

* Use App Router.
* Prefer Server Components.
* Add `"use client"` only when required.
* Minimize client-side JavaScript.

## Changes

* Modify only what's needed.
* Don't regenerate unchanged code.
* Show only affected files/snippets unless asked otherwise.
* Preserve formatting and naming conventions.
* Remove unused imports.

## Git

* Keep changes focused.
* Suggest Conventional Commit messages.
* Avoid unrelated refactors.

## Responses

* Answer directly; no filler.
* Recommend one approach when multiple are valid.
* Explain trade-offs only when relevant.
* Ask questions only if blocked.
* Avoid repeating context.
* No web search unless requested or time-sensitive.

## Context
This project is a production-quality Next.js creator dashboard. Favor scalable architecture, clean abstractions, and long-term maintainability over quick implementations.
Only use shadcn ui components only