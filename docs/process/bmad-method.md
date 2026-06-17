# FRÍA — BMAD Method

BMAD is the workflow for intent → spec → architecture → story → implementation
→ QA evidence. Use it for any meaningful change.

## Required For (FRÍA)

- New screens, hooks, socket events, or DB tables.
- Auth, permissions, room/session semantics.
- Cross-module workflows (chat + map + presence).
- Persistence changes (any new SQL).
- Production launch decisions (Railway, EAS, app store).

Not required for:

- One-line bug fixes.
- Cosmetic renames.
- Dependency bumps that don't change public API.

## Brief

- Product outcome.
- User role.
- Business value.
- Problem.
- In scope.
- Out of scope.

## Quick Spec

- Route / entry point / socket event.
- Components / folders / files.
- Data read.
- Data mutated.
- Permissions.
- Async states.
- Acceptance criteria.

## Architecture

- Contracts (socket events, DB schema).
- Migrations.
- Services.
- Security.
- Tests.
- Rollback / recovery.

## Story Template

```txt
As <role>,
I need <capability>,
so that <business outcome>.

Acceptance criteria:
- Observable behavior
- Data/API contract
- Auth/security behavior
- State/failure behavior
- QA evidence (commands run + results)
```

Stories live in `docs/stories/` with zero-padded numbers
(`001-postgres-persistence.md`).

## QA Gate

Run the smallest meaningful checks and document the command + outcome in the
story's "QA evidence" section.

## Caveman Note

FRÍA's docs default to dense Spanish/English prose. If a session asks for
caveman mode, only the chat replies compress — engineering rigor is unchanged.
