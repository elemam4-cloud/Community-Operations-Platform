# Authorization model v0.9

Authorization is enforced server-side for every request. UI visibility is convenience only and never a security boundary.

## Decision order

1. Resolve authenticated user identity.
2. Resolve active community membership.
3. Resolve roles and unit memberships.
4. Check the operation permission.
5. Check record scope (community, unit, assigned work, or gate role).
6. Write an audit event for every mutation.

## Permissions

```text
community.manage
residents.read / residents.manage
vehicles.read / vehicles.manage
parking.read / parking.manage
permits.issue / permits.revoke / permits.check
gates.check / gates.record
maintenance.create / maintenance.assign / maintenance.update / maintenance.close
announcements.publish
notifications.read / notifications.send
reports.read
audit.read
```

## Default role bundles

- `admin`: all permissions.
- `operations`: residents, vehicles, parking, permits, maintenance, announcements, notifications, reports.
- `security`: permits.check, gates.check, gates.record, vehicles.read, parking.read.
- `resident`: own unit, own vehicles, permits.issue for own unit, maintenance.create/own-ticket-read, notifications.read.
- `provider`: assigned maintenance tickets and the permit needed for an assigned visit.

## Manual gate operation

Manual gate opening is an explicit, policy-controlled operation. It may be enabled for a community as `manual_gate_override`; it is available to `security`, `operations`, and `admin` roles, whether or not electricity and normal readers are available. Every manual event must include the gate, direction, decision, operator identity, timestamp, and a reason. The event is stored as a gate event and mirrored into the audit trail. Disabling the policy removes the option without deleting historical events.

## Sensitive operations

Changing roles, revoking a permanent vehicle access tag, exporting personal data, deleting a community, and changing retention settings require elevated permission and an audit reason.

