# Quality, reality and AI readiness gate v1.4

No release is complete until the relevant checks below have evidence.

## Real-world operating scenarios

- A resident has no smartphone or cannot use the app.
- Internet or power fails at a gate.
- A visitor arrives before the resident responds.
- A domestic worker serves multiple units with different schedules.
- A maintenance provider arrives outside the approved window.
- A vehicle tag and camera plate disagree.
- Two people attempt to use the same parking space.
- A resident moves out while permits and vehicles remain active.
- An emergency requires manual gate opening and later reconciliation.
- A community operates in Arabic while a provider uses English.

## Release gates

1. Data: schema migration, constraints, indexes, seed isolation and restore test.
2. Security: authentication, role checks, community scoping, audit events and data minimization.
3. Reliability: retries, idempotency, offline/manual gate fallback and duplicate prevention.
4. UX: mobile layout, RTL/LTR, clear guidance, empty states, validation and accessible actions.
5. Operations: support roles, export, retention, incident procedure and recovery owner.
6. Scale: pagination, rate limits, peak gate traffic, notification fan-out and archival policy.
7. Integration: vendor-neutral adapters for RFID/UHF, ANPR, barriers, messaging and payments.

## AI role

AI is an assistive layer, not the final authority for access, fines, identity, payments or safety decisions.

Safe first uses:

- Arabic/English message drafting with human approval.
- Ticket classification and suggested priority.
- Duplicate complaint detection.
- Summaries of maintenance history and community announcements.
- Natural-language reports over permission-filtered data.
- Anomaly alerts for unusual access patterns, always reviewable by staff.

Required AI controls:

- Human approval for external messages and consequential actions.
- No raw national IDs, passwords, payment data or unnecessary images in prompts.
- Tenant/community isolation in retrieval and analytics.
- Evidence links for every generated recommendation.
- Confidence and uncertainty displayed to the reviewer.
- Prompt/model versioning, logs and an immediate disable switch.
- No training on community data unless explicitly authorized.

## Review rule

Before each release, review source, database, permissions, UI behavior, failure paths, backup restore and migration compatibility. Record what was tested, what remains uncertain, and who owns the next action.

