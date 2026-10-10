# API smoke tests

Set `BASE_URL` to the Worker URL and use a signed-in request context. These tests are intentionally small and can run against a local Worker, preview, or production after the D1 binding exists.

## Authentication and membership

```text
GET $BASE_URL/api/demo-community/units
Headers: oai-authenticated-user-id=user-admin
Expected: 200 and unit list
```

```text
GET $BASE_URL/api/demo-community/units
Without identity headers
Expected: 401
```

## Vehicle visibility

```text
GET $BASE_URL/api/demo-community/vehicles
Headers: oai-authenticated-user-id=user-security
Expected: 200 and no unrelated community records
```

## Permit lifecycle

```text
POST $BASE_URL/api/demo-community/permits
Headers: oai-authenticated-user-id=user-sara
Body: {"unit_id":"unit-c305","subject_name":"Visitor Test","permit_type":"visitor","starts_at":"2026-10-10T08:00:00Z","expires_at":"2026-10-10T18:00:00Z"}
Expected: 201, active permit, audit event
```

## Maintenance lifecycle

```text
POST $BASE_URL/api/demo-community/maintenance-tickets
Headers: oai-authenticated-user-id=user-ahmed
Body: {"unit_id":"unit-a204","title":"Smoke test ticket","priority":"normal"}
Expected: 201, open ticket, audit event
```

## Negative cases

- Missing required permit fields → `400`.
- Unknown community membership → `403`.
- Missing D1 binding → `503` with no write attempted.
- Resident attempting an admin-only operation → `403`.
- Expired permit check → deny and append a gate event.

