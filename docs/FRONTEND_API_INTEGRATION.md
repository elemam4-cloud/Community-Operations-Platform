# Frontend/API integration

The static dashboard remains usable in local demo mode through `localStorage`. It now exposes a single `window.CommunityAPI` adapter for the server-backed mode.

Before hosting the dashboard with the Worker, set:

```html
<script>
  window.COMMUNITY_API_BASE = "https://api.example.com";
  window.COMMUNITY_ID = "community-id";
  window.COMMUNITY_AUTH_HEADERS = {
    "oai-authenticated-user-id": "authenticated-user-id",
    "oai-authenticated-user-email": "authenticated-user-email"
  };
</script>
```

The adapter covers dashboard metrics, units, vehicles, parking, visits, maintenance tickets, announcements, notifications, notification preferences, leases, lease payments, unit mailboxes, modules, and the first write operations. Authentication is intentionally delegated to the hosting/identity layer; credentials and identity tokens are never stored in the browser demo state.

The dashboard calls `GET /api/{community_id}/dashboard` during startup when `COMMUNITY_API_BASE` is present. If the request fails, it keeps the clearly labeled demo values and does not silently treat demo data as production data.

The maintenance action is also dual-mode: the maintenance form writes to `POST /api/{community_id}/maintenance-tickets` when the API is configured, while remaining a local demo record when it is not. The dashboard refreshes its metrics after a successful server-backed ticket.

The dashboard displays the server-provided `operational_state` and `last_successful_sync_at` values. During local continuity, manual fallback, or recovery review, it warns operators not to treat stale parking or access data as current.

The dashboard also exposes a controlled manual-gate panel for authorized operators. It sends `POST /api/{community_id}/gate-events` with `manual_override=true` and a required reason when server-backed mode is active; the server remains the authority for role and policy checks.

Vehicle registration is dual-mode as well: the vehicle form sends `POST /api/{community_id}/vehicles` with the plate and optional access tag in server-backed mode, and remains explicitly local-demo data otherwise.

If `COMMUNITY_API_BASE` is absent, the interface continues in clearly limited local-demo mode. This preserves an external recovery path while allowing the same UI to be connected to D1 later.

