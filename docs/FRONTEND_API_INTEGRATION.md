# Frontend/API integration

The static dashboard remains usable in local demo mode through `localStorage`. It now exposes a single `window.CommunityAPI` adapter for the server-backed mode.

Before hosting the dashboard with the Worker, set:

```html
<script>
  window.COMMUNITY_API_BASE = "https://api.example.com";
  window.COMMUNITY_ID = "community-id";
</script>
```

The adapter covers units, vehicles, parking, maintenance tickets, announcements, notifications, and the first write operations. Authentication is intentionally delegated to the hosting/identity layer; credentials and identity tokens are never stored in the browser demo state.

If `COMMUNITY_API_BASE` is absent, the interface continues in clearly limited local-demo mode. This preserves an external recovery path while allowing the same UI to be connected to D1 later.

