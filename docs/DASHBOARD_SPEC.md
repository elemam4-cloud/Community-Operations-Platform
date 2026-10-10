# Dashboard Product Specification

## Product standard

The dashboard is the operating control surface, not a decorative summary. Every metric must answer three questions: what is happening, what requires attention, and what action is available next.

## Role-aware views

- **Admin:** community health, module states, security exceptions, service performance, lease exposure, communication delivery, and audit alerts.
- **Operations:** open work orders, expected visits, parking exceptions, upcoming leases, announcements, and unit mailbox workload.
- **Security:** live entry queue, expected visitors, active permits, gate exceptions, occupancy signals, and manual fallback status.
- **Resident:** own unit, vehicles, permits, maintenance tickets, lease installments, notifications, and unit mailbox.
- **Provider:** assigned work orders, approved permits, scheduled access, and required acknowledgements.

## Visual hierarchy

1. Header: community selector, date/timezone, role, notifications, and language switch.
2. Attention strip: urgent alerts and failed integrations only.
3. KPI cards: compact, comparable, clickable, with trend or status context.
4. Operational queues: items requiring action, ordered by urgency and due time.
5. Activity timeline: recent access, maintenance, communication, and payment events.
6. Secondary analytics: parking occupancy, service SLA, delivery load, and module health.

## Interaction rules

- Every card opens the filtered operational list behind it.
- Empty states explain the next setup step.
- Loading, offline, stale, and permission-limited states are explicit.
- Red is reserved for risk or overdue work; amber means attention; green means healthy or available.
- Demo data must never appear as production data without a visible demo indicator.
- Mobile layout prioritizes urgent actions, notifications, permits, tickets, and mailbox items.

## Data contract

The initial dashboard consumes `GET /api/{community_id}/dashboard` and then loads the relevant detail endpoint only when a user opens a card. This avoids unnecessary data exposure and keeps the interface responsive.

## Quality gate

Before release, verify keyboard navigation, mobile layout, Arabic/English labels, role scoping, empty states, offline behavior, and that every displayed number can be traced to a current API response.

