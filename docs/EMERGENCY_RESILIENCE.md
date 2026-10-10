# Emergency Resilience and Power-Outage Operations

## Operating principle

The platform is designed as a layered system. A power outage must not be treated as a single failure: the cloud application, local network, gate controller, cameras, readers, lighting, and operator procedures each have a different continuity requirement.

## Continuity tiers

### Tier 1 — Cloud and application

- The API and database are hosted independently from the community's local electricity supply.
- Users who still have internet and phone power can view announcements, tickets, permits, and cached status.
- Every write is auditable and must include its source and timestamp.

### Tier 2 — Local access control

- Gate controllers, readers, barrier motors, intercoms, and essential network equipment should be on UPS power.
- The controller must retain the last approved access policy locally and continue validating already-issued vehicle tags, QR permits, and staff credentials during a temporary WAN outage.
- Emergency policy is configurable per community: fail-secure, fail-safe, or controlled manual release. The platform must never assume one policy fits all sites.
- When connectivity returns, queued gate events are synchronized with original device timestamps and marked as offline-captured.

### Tier 3 — Power and facility operations

- The community operator should define which gates, server/network racks, parking sensors, cameras, and lighting circuits are critical.
- A generator or extended battery system can keep the critical subset operating; non-critical amenities may remain offline.
- Parking occupancy may become “unknown” when sensors lose power. The dashboard must not present stale sensor readings as current availability.

## Offline operating modes

1. **Online:** normal API validation, live dashboard, event synchronization.
2. **Local continuity:** local controller validates cached rules and credentials; mobile/web shows limited read-only status when reachable.
3. **Manual fallback:** security uses printed emergency rosters, operator-issued temporary passes, and a paper or offline log. Each event is reconciled later.
4. **Recovery:** operators review conflicts, duplicate events, expired permits, and manual overrides before closing the incident.

## Data and security rules

- Never silently discard offline events.
- Keep the last successful policy snapshot and its effective time on the local controller.
- Expired credentials must remain expired even when offline; emergency override requires an explicit role and reason.
- Record power state, network state, device identity, operator identity, and reconciliation status in the audit trail.
- Notify residents when access rules are temporarily relaxed or when services are degraded.

## Dashboard behavior

The dashboard should show a prominent operational state: `Online`, `Local continuity`, `Manual fallback`, or `Recovery review`. It should show the last synchronization time and distinguish `available`, `occupied`, and `unknown` parking states. This prevents operators from making safety decisions from stale data.

## Implementation boundary

The SaaS platform can provide the policy model, audit trail, cached-credential contract, queued-event contract, alerts, and recovery workflow. UPS units, generators, gate controllers, readers, cameras, and sensor hardware require a site-specific installation and integration assessment.

