// Portable D1/Cloudflare Worker API layer.
// The Site adapter can mount this handler after a DB binding named DB is provisioned.

const json = (data, status = 200) => new Response(JSON.stringify({ data, error: null }), {
  status, headers: { "content-type": "application/json; charset=utf-8" }
});
const fail = (message, status = 400) => new Response(JSON.stringify({ data: null, error: message }), {
  status, headers: { "content-type": "application/json; charset=utf-8" }
});

function identity(request) {
  const id = request.headers.get("oai-authenticated-user-id");
  const email = request.headers.get("oai-authenticated-user-email");
  return id ? { id, email } : null;
}

async function role(db, userId, communityId) {
  const row = await db.prepare(`SELECT ur.role FROM user_roles ur JOIN users u ON u.id=ur.user_id WHERE ur.user_id=? AND u.community_id=? LIMIT 1`).bind(userId, communityId).first();
  return row?.role || null;
}

async function policy(db, communityId, key, fallback = true) {
  const row = await db.prepare(`SELECT enabled FROM community_policies WHERE community_id=? AND policy_key=?`).bind(communityId, key).first();
  return row ? Boolean(row.enabled) : fallback;
}

async function moduleStatus(db, communityId, key) {
  const row = await db.prepare(`SELECT status FROM community_modules WHERE community_id=? AND module_key=?`).bind(communityId, key).first();
  return row?.status || "enabled";
}

const can = (userRole, action) => userRole === "admin" ||
  (action === "read" && ["operations", "security", "resident", "provider"].includes(userRole)) ||
  (action === "permit" && ["operations", "security", "resident"].includes(userRole)) ||
  (action === "maintenance" && ["operations", "resident", "provider"].includes(userRole));

export default {
  async fetch(request, env) {
    if (!env.DB) return fail("Database binding DB is not configured", 503);
    const user = identity(request);
    if (!user) return fail("Authentication required", 401);
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const communityId = parts[1];
    if (parts[0] !== "api" || !communityId) return fail("Not found", 404);
    const userRole = await role(env.DB, user.id, communityId);
    if (!userRole) return fail("Community membership required", 403);
    const action = parts[2];
    const moduleByAction = {
      units: "core_identity", vehicles: "vehicles_parking", parking: "vehicles_parking", "parking-assignments": "vehicles_parking", "parking-claim": "vehicles_parking", "parking-occupancy": "vehicles_parking",
      permits: "permits_visitors", "permit-revoke": "permits_visitors", "gate-check": "access_security", "gate-events": "access_security",
      "maintenance-tickets": "maintenance", announcements: "information_center", notifications: "information_center", "unit-mailbox": "unit_mailbox",
      leases: "leases", "lease-payments": "lease_payments", "notification-preferences": "information_center", "commercial-units": "commercial_operations", "loading-slots": "commercial_operations", "loading-bookings": "commercial_operations"
    };
    const moduleKey = moduleByAction[action];
    if (moduleKey && await moduleStatus(env.DB, communityId, moduleKey) === "disabled") return fail("This module is disabled for the community", 404);
    if (request.method === "GET" && action === "units") {
      if (!can(userRole, "read")) return fail("Forbidden", 403);
      const result = await env.DB.prepare(`SELECT id,code,status,building_id FROM units WHERE community_id=? ORDER BY code`).bind(communityId).all();
      return json(result.results);
    }
    if (request.method === "GET" && action === "vehicles") {
      if (!can(userRole, "read")) return fail("Forbidden", 403);
      const scopeEnabled = await policy(env.DB, communityId, "resident_vehicle_scope");
      const residentScope = userRole === "resident" && scopeEnabled ? " AND primary_user_id=?" : "";
      const params = userRole === "resident" ? [communityId, user.id] : [communityId];
      const result = await env.DB.prepare(`SELECT id,plate_number,access_tag,status,primary_user_id FROM vehicles WHERE community_id=?${residentScope} ORDER BY plate_number`).bind(...params).all();
      return json(result.results);
    }
    if (request.method === "GET" && action === "parking") {
      if (!can(userRole, "read")) return fail("Forbidden", 403);
      const result = await env.DB.prepare(`SELECT id,code,zone,parking_type,allocation_mode,assigned_unit_id,access_control,status,occupancy_state,occupancy_source,sensor_ref,last_observed_at FROM parking_spaces WHERE community_id=? ORDER BY code`).bind(communityId).all();
      return json(result.results);
    }
    if (request.method === "GET" && action === "maintenance-tickets") {
      if (!can(userRole, "read")) return fail("Forbidden", 403);
      const residentScope = userRole === "resident" ? " AND requester_id=?" : "";
      const params = userRole === "resident" ? [communityId, user.id] : [communityId];
      const result = await env.DB.prepare(`SELECT id,unit_id,requester_id,assigned_to,title,description,priority,status,created_at,closed_at FROM maintenance_tickets WHERE community_id=?${residentScope} ORDER BY created_at DESC LIMIT 100`).bind(...params).all();
      return json(result.results);
    }
    if (request.method === "GET" && action === "announcements") {
      if (!can(userRole, "read")) return fail("Forbidden", 403);
      const result = await env.DB.prepare(`SELECT id,title,body,content_type,audience,delivery_channels,scheduled_at,published_at,created_at FROM announcements WHERE community_id=? AND published_at IS NOT NULL AND (scheduled_at IS NULL OR scheduled_at<=datetime('now')) ORDER BY published_at DESC LIMIT 100`).bind(communityId).all();
      return json(result.results);
    }
    if (request.method === "POST" && action === "vehicles") {
      if (!can(userRole, "read")) return fail("Forbidden", 403);
      const body = await request.json().catch(() => null);
      if (!body?.plate_number) return fail("Plate number is required");
      const ownerId = userRole === "resident" ? user.id : (body.primary_user_id || user.id);
      const id = crypto.randomUUID();
      await env.DB.prepare(`INSERT INTO vehicles (id,community_id,primary_user_id,plate_number,access_tag,status) VALUES (?,?,?,?,?,?)`).bind(id, communityId, ownerId, body.plate_number.trim(), body.access_tag || null, "active").run();
      await env.DB.prepare(`INSERT INTO audit_events (id,community_id,actor_user_id,action,entity_type,entity_id,created_at) VALUES (?,?,?,?,?,?,?)`).bind(crypto.randomUUID(), communityId, user.id, "vehicle.create", "vehicle", id, new Date().toISOString()).run();
      return json({ id, status: "active" }, 201);
    }
    if (request.method === "POST" && action === "parking-assignments") {
      if (userRole !== "admin" && userRole !== "operations") return fail("Forbidden", 403);
      const body = await request.json().catch(() => null);
      if (!body?.parking_space_id || !body?.unit_id) return fail("Parking space and unit are required");
      const space = await env.DB.prepare(`SELECT id,status,parking_type,allocation_mode,assigned_unit_id FROM parking_spaces WHERE id=? AND community_id=?`).bind(body.parking_space_id, communityId).first();
      if (!space) return fail("Parking space not found", 404);
      if (space.status === "assigned") return fail("Parking space is already assigned", 409);
      if (space.parking_type === "private" && space.assigned_unit_id && space.assigned_unit_id !== body.unit_id) return fail("Private parking belongs to another unit", 403);
      if (await policy(env.DB, communityId, "parking_unit_validation")) {
        const unit = await env.DB.prepare(`SELECT id FROM units WHERE id=? AND community_id=?`).bind(body.unit_id, communityId).first();
        if (!unit) return fail("Unit not found", 404);
      }
      await env.DB.prepare(`UPDATE parking_spaces SET assigned_unit_id=?,status='assigned' WHERE id=? AND community_id=?`).bind(body.unit_id, body.parking_space_id, communityId).run();
      await env.DB.prepare(`INSERT INTO audit_events (id,community_id,actor_user_id,action,entity_type,entity_id,created_at) VALUES (?,?,?,?,?,?,?)`).bind(crypto.randomUUID(), communityId, user.id, "parking.assign", "parking_space", body.parking_space_id, new Date().toISOString()).run();
      return json({ id: body.parking_space_id, status: "assigned" }, 201);
    }
    if (request.method === "POST" && action === "parking-claim") {
      if (userRole !== "resident") return fail("Only residents can claim first-come parking", 403);
      const body = await request.json().catch(() => null);
      if (!body?.parking_space_id || !body?.unit_id) return fail("Parking space and unit are required");
      const membership = await env.DB.prepare(`SELECT unit_id FROM unit_memberships WHERE unit_id=? AND user_id=?`).bind(body.unit_id, user.id).first();
      if (!membership) return fail("Resident is not authorized for this unit", 403);
      const space = await env.DB.prepare(`SELECT id,status,allocation_mode FROM parking_spaces WHERE id=? AND community_id=?`).bind(body.parking_space_id, communityId).first();
      if (!space) return fail("Parking space not found", 404);
      if (space.allocation_mode !== "first_come") return fail("Parking space is not first-come", 409);
      if (space.status !== "available") return fail("Parking space is not available", 409);
      await env.DB.prepare(`UPDATE parking_spaces SET assigned_unit_id=?,status='assigned' WHERE id=? AND community_id=? AND status='available' AND allocation_mode='first_come'`).bind(body.unit_id, body.parking_space_id, communityId).run();
      await env.DB.prepare(`INSERT INTO audit_events (id,community_id,actor_user_id,action,entity_type,entity_id,created_at) VALUES (?,?,?,?,?,?,?)`).bind(crypto.randomUUID(), communityId, user.id, "parking.claim", "parking_space", body.parking_space_id, new Date().toISOString()).run();
      return json({ id: body.parking_space_id, status: "assigned" }, 201);
    }
    if (request.method === "POST" && action === "parking-occupancy") {
      if (userRole !== "admin" && userRole !== "operations" && userRole !== "security") return fail("Forbidden", 403);
      const body = await request.json().catch(() => null);
      if (!body?.parking_space_id || !["occupied", "vacant", "unknown"].includes(body.occupancy_state)) return fail("Invalid occupancy update");
      const now = new Date().toISOString();
      await env.DB.prepare(`UPDATE parking_spaces SET occupancy_state=?,occupancy_source=?,sensor_ref=?,last_observed_at=? WHERE id=? AND community_id=?`).bind(body.occupancy_state, body.source || "manual", body.sensor_ref || null, now, body.parking_space_id, communityId).run();
      return json({ id: body.parking_space_id, occupancy_state: body.occupancy_state, indicator: body.occupancy_state === "occupied" ? "red" : body.occupancy_state === "vacant" ? "green" : "amber" });
    }
    if (request.method === "POST" && action === "gate-check") {
      if (!can(userRole, "permit") && userRole !== "security") return fail("Forbidden", 403);
      const body = await request.json().catch(() => null);
      if (!body?.permit_id) return fail("Permit is required");
      const permit = await env.DB.prepare(`SELECT id,status,starts_at,expires_at FROM permits WHERE id=? AND community_id=?`).bind(body.permit_id, communityId).first();
      const now = Date.now();
      const allowed = Boolean(permit && permit.status === "active" && new Date(permit.starts_at).getTime() <= now && new Date(permit.expires_at).getTime() > now);
      return json({ allowed, reason: allowed ? "active_permit" : "missing_or_expired_permit" });
    }
    if (request.method === "POST" && action === "gate-events") {
      if (userRole !== "admin" && userRole !== "operations" && userRole !== "security") return fail("Forbidden", 403);
      const body = await request.json().catch(() => null);
      if (!body?.gate_name || !body?.direction || !body?.decision) return fail("Gate event fields are incomplete");
      if (await policy(env.DB, communityId, "gate_value_validation")) {
        if (!["entry", "exit"].includes(body.direction)) return fail("Invalid gate direction");
        if (!["allowed", "denied"].includes(body.decision)) return fail("Invalid gate decision");
      }
      const id = crypto.randomUUID();
      await env.DB.prepare(`INSERT INTO gate_events (id,community_id,permit_id,vehicle_id,gate_name,direction,decision,captured_at,source) VALUES (?,?,?,?,?,?,?,?,?)`).bind(id, communityId, body.permit_id || null, body.vehicle_id || null, body.gate_name, body.direction, body.decision, new Date().toISOString(), body.source || "manual").run();
      return json({ id }, 201);
    }
    if (request.method === "POST" && action === "permits") {
      if (!can(userRole, "permit")) return fail("Forbidden", 403);
      const body = await request.json().catch(() => null);
      if (!body?.subject_name || !body?.permit_type || !body?.starts_at || !body?.expires_at) return fail("Permit fields are incomplete");
      const starts = new Date(body.starts_at).getTime();
      const expires = new Date(body.expires_at).getTime();
      if (await policy(env.DB, communityId, "permit_time_window") && (!Number.isFinite(starts) || !Number.isFinite(expires) || expires <= starts)) return fail("Permit time range is invalid");
      const ownershipScope = await policy(env.DB, communityId, "resident_ownership_scope");
      if (ownershipScope && userRole === "resident" && body.unit_id) {
        const membership = await env.DB.prepare(`SELECT unit_id FROM unit_memberships WHERE unit_id=? AND user_id=?`).bind(body.unit_id, user.id).first();
        if (!membership) return fail("Resident is not authorized for this unit", 403);
      }
      if (ownershipScope && userRole === "resident" && body.vehicle_id) {
        const vehicle = await env.DB.prepare(`SELECT id FROM vehicles WHERE id=? AND community_id=? AND primary_user_id=?`).bind(body.vehicle_id, communityId, user.id).first();
        if (!vehicle) return fail("Resident is not authorized for this vehicle", 403);
      }
      const id = crypto.randomUUID();
      await env.DB.prepare(`INSERT INTO permits (id,community_id,issued_by,unit_id,vehicle_id,subject_name,permit_type,starts_at,expires_at,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(id, communityId, user.id, body.unit_id || null, body.vehicle_id || null, body.subject_name, body.permit_type, body.starts_at, body.expires_at, "active", new Date().toISOString()).run();
      await env.DB.prepare(`INSERT INTO audit_events (id,community_id,actor_user_id,action,entity_type,entity_id,created_at) VALUES (?,?,?,?,?,?,?)`).bind(crypto.randomUUID(), communityId, user.id, "permit.issue", "permit", id, new Date().toISOString()).run();
      return json({ id, status: "active" }, 201);
    }
    if (request.method === "POST" && action === "permit-revoke") {
      if (!can(userRole, "permit")) return fail("Forbidden", 403);
      const body = await request.json().catch(() => null);
      if (!body?.permit_id) return fail("Permit is required");
      await env.DB.prepare(`UPDATE permits SET status='revoked' WHERE id=? AND community_id=? AND status='active'`).bind(body.permit_id, communityId).run();
      await env.DB.prepare(`INSERT INTO audit_events (id,community_id,actor_user_id,action,entity_type,entity_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(), communityId, user.id, "permit.revoke", "permit", body.permit_id, JSON.stringify({reason:body.reason||null}), new Date().toISOString()).run();
      return json({ id: body.permit_id, status: "revoked" });
    }
    if (request.method === "POST" && action === "maintenance-tickets") {
      if (!can(userRole, "maintenance")) return fail("Forbidden", 403);
      const body = await request.json().catch(() => null);
      if (!body?.title) return fail("Ticket title is required");
      const id = crypto.randomUUID();
      await env.DB.prepare(`INSERT INTO maintenance_tickets (id,community_id,unit_id,requester_id,title,description,priority,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)`).bind(id, communityId, body.unit_id || null, user.id, body.title, body.description || null, body.priority || "normal", "open", new Date().toISOString()).run();
      await env.DB.prepare(`INSERT INTO audit_events (id,community_id,actor_user_id,action,entity_type,entity_id,created_at) VALUES (?,?,?,?,?,?,?)`).bind(crypto.randomUUID(), communityId, user.id, "maintenance.create", "maintenance_ticket", id, new Date().toISOString()).run();
      return json({ id, status: "open" }, 201);
    }
    if (request.method === "PATCH" && action === "maintenance-tickets") {
      if (!can(userRole, "maintenance")) return fail("Forbidden", 403);
      const body = await request.json().catch(() => null);
      if (!body?.ticket_id || !body?.status) return fail("Ticket and status are required");
      const allowedStatuses = ["open", "in_progress", "scheduled", "resolved", "closed"];
      if (!allowedStatuses.includes(body.status)) return fail("Invalid ticket status");
      const ticket = await env.DB.prepare(`SELECT id,requester_id FROM maintenance_tickets WHERE id=? AND community_id=?`).bind(body.ticket_id, communityId).first();
      if (!ticket) return fail("Ticket not found", 404);
      if (userRole === "resident" && ticket.requester_id !== user.id) return fail("Residents may update only their own tickets", 403);
      const now = new Date().toISOString();
      await env.DB.prepare(`UPDATE maintenance_tickets SET status=?,closed_at=? WHERE id=? AND community_id=?`).bind(body.status, body.status === "closed" ? now : null, body.ticket_id, communityId).run();
      await env.DB.prepare(`INSERT INTO ticket_history (id,ticket_id,changed_by,to_status,note,changed_at) VALUES (?,?,?,?,?,?)`).bind(crypto.randomUUID(), body.ticket_id, user.id, body.status, body.note || null, now).run();
      await env.DB.prepare(`INSERT INTO audit_events (id,community_id,actor_user_id,action,entity_type,entity_id,created_at) VALUES (?,?,?,?,?,?,?)`).bind(crypto.randomUUID(), communityId, user.id, "maintenance.update", "maintenance_ticket", body.ticket_id, now).run();
      return json({ id: body.ticket_id, status: body.status });
    }
    if (request.method === "POST" && action === "announcements") {
      if (!can(userRole, "maintenance") && userRole !== "operations" && userRole !== "admin") return fail("Forbidden", 403);
      const body = await request.json().catch(() => null);
      if (!body?.title || !body?.body) return fail("Announcement title and body are required");
      const contentTypes = ["announcement", "alert", "event", "maintenance"];
      const audiences = ["all", "residents", "staff", "security", "providers"];
      const channels = ["in_app", "email", "sms", "whatsapp"];
      if (body.content_type && !contentTypes.includes(body.content_type)) return fail("Invalid information content type");
      if (body.audience && !audiences.includes(body.audience)) return fail("Invalid information audience");
      const selectedChannels = Array.isArray(body.delivery_channels) && body.delivery_channels.length ? body.delivery_channels : ["in_app"];
      if (selectedChannels.some(channel => !channels.includes(channel))) return fail("Invalid delivery channel");
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const audience = body.audience || "all";
      const audienceWhere = audience === "all" ? "" : audience === "residents" ? " AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id=users.id AND ur.role='resident')" : audience === "staff" ? " AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id=users.id AND ur.role IN ('admin','operations'))" : audience === "security" ? " AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id=users.id AND ur.role='security')" : " AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id=users.id AND ur.role='provider')";
      await env.DB.prepare(`INSERT INTO announcements (id,community_id,author_id,title,body,content_type,audience,delivery_channels,scheduled_at,published_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(id, communityId, user.id, body.title, body.body, body.content_type || "announcement", audience, selectedChannels.join(","), body.scheduled_at || null, body.scheduled_at ? null : now, now).run();
      const recipients = await env.DB.prepare(`SELECT id FROM users WHERE community_id=? AND status='active'${audienceWhere}`).bind(communityId).all();
      for (const recipient of recipients.results || []) {
        for (const channel of selectedChannels) {
          const preference = await env.DB.prepare(`SELECT enabled FROM notification_preferences WHERE user_id=? AND channel=?`).bind(recipient.id, channel).first();
          if (preference && !preference.enabled) continue;
          await env.DB.prepare(`INSERT INTO notifications (id,community_id,user_id,announcement_id,channel,delivery_status,created_at) VALUES (?,?,?,?,?,?,?)`).bind(crypto.randomUUID(), communityId, recipient.id, id, channel, "pending", now).run();
        }
      }
      await env.DB.prepare(`INSERT INTO audit_events (id,community_id,actor_user_id,action,entity_type,entity_id,created_at) VALUES (?,?,?,?,?,?,?)`).bind(crypto.randomUUID(), communityId, user.id, "announcement.publish", "announcement", id, now).run();
      return json({ id, published_at: now }, 201);
    }
    if (request.method === "GET" && action === "notifications") {
      const result = await env.DB.prepare(`SELECT id,channel,delivery_status,read_at,created_at FROM notifications WHERE community_id=? AND user_id=? ORDER BY created_at DESC LIMIT 100`).bind(communityId, user.id).all();
      return json(result.results);
    }
    if (request.method === "GET" && action === "unit-mailbox") {
      if (!can(userRole, "read")) return fail("Forbidden", 403);
      const unitId = url.searchParams.get("unit_id");
      if (userRole === "resident") {
        const membership = await env.DB.prepare(`SELECT unit_id FROM unit_memberships WHERE unit_id=? AND user_id=? AND EXISTS (SELECT 1 FROM units WHERE units.id=unit_memberships.unit_id AND units.community_id=?)`).bind(unitId, user.id, communityId).first();
        if (!membership) return fail("Resident is not authorized for this unit", 403);
      }
      if (!unitId) return fail("Unit is required");
      const result = await env.DB.prepare(`SELECT id,unit_id,item_type,subject,body,reference_code,status,received_at,read_at,collected_at FROM unit_mail_items WHERE community_id=? AND unit_id=? ORDER BY received_at DESC LIMIT 100`).bind(communityId, unitId).all();
      return json(result.results);
    }
    if (request.method === "POST" && action === "unit-mailbox") {
      if (userRole !== "admin" && userRole !== "operations" && userRole !== "security") return fail("Forbidden", 403);
      const body = await request.json().catch(() => null);
      if (!body?.unit_id || !body?.subject) return fail("Unit and subject are required");
      if (body.item_type && !["message", "document", "parcel", "registered_mail", "notice"].includes(body.item_type)) return fail("Invalid mailbox item type");
      const unit = await env.DB.prepare(`SELECT id FROM units WHERE id=? AND community_id=?`).bind(body.unit_id, communityId).first();
      if (!unit) return fail("Unit not found", 404);
      const id = crypto.randomUUID();
      await env.DB.prepare(`INSERT INTO unit_mail_items (id,community_id,unit_id,item_type,subject,body,reference_code,status,received_at,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(id, communityId, body.unit_id, body.item_type || "message", body.subject, body.body || null, body.reference_code || null, body.item_type === "parcel" || body.item_type === "registered_mail" ? "awaiting_collection" : "unread", new Date().toISOString(), user.id).run();
      return json({ id, status: body.item_type === "parcel" || body.item_type === "registered_mail" ? "awaiting_collection" : "unread" }, 201);
    }
    if (request.method === "PATCH" && action === "unit-mailbox") {
      if (!can(userRole, "read")) return fail("Forbidden", 403);
      const body = await request.json().catch(() => null);
      if (!body?.item_id || !["read", "unread", "awaiting_collection", "collected", "archived"].includes(body.status)) return fail("Invalid mailbox status");
      const item = await env.DB.prepare(`SELECT id,unit_id FROM unit_mail_items WHERE id=? AND community_id=?`).bind(body.item_id, communityId).first();
      if (!item) return fail("Mailbox item not found", 404);
      if (userRole === "resident") {
        const membership = await env.DB.prepare(`SELECT unit_id FROM unit_memberships WHERE unit_id=? AND user_id=?`).bind(item.unit_id, user.id).first();
        if (!membership) return fail("Resident is not authorized for this unit", 403);
      }
      const now = new Date().toISOString();
      await env.DB.prepare(`UPDATE unit_mail_items SET status=?,read_at=?,collected_at=? WHERE id=? AND community_id=?`).bind(body.status, body.status === "read" ? now : null, body.status === "collected" ? now : null, body.item_id, communityId).run();
      return json({ id: body.item_id, status: body.status });
    }
    if (request.method === "PATCH" && action === "notifications") {
      const body = await request.json().catch(() => null);
      if (!body?.notification_id) return fail("Notification is required");
      const now = new Date().toISOString();
      await env.DB.prepare(`UPDATE notifications SET read_at=? WHERE id=? AND community_id=? AND user_id=?`).bind(now, body.notification_id, communityId, user.id).run();
      return json({ id: body.notification_id, read_at: now });
    }
    if (request.method === "GET" && action === "notification-preferences") {
      const result = await env.DB.prepare(`SELECT channel,enabled,updated_at FROM notification_preferences WHERE user_id=? ORDER BY channel`).bind(user.id).all();
      return json(result.results);
    }
    if (request.method === "PATCH" && action === "notification-preferences") {
      const body = await request.json().catch(() => null);
      if (!body?.channel || !["in_app", "email", "sms", "whatsapp"].includes(body.channel) || typeof body.enabled !== "boolean") return fail("Invalid notification preference");
      const now = new Date().toISOString();
      await env.DB.prepare(`INSERT INTO notification_preferences (user_id,channel,enabled,updated_at) VALUES (?,?,?,?) ON CONFLICT(user_id,channel) DO UPDATE SET enabled=excluded.enabled,updated_at=excluded.updated_at`).bind(user.id, body.channel, body.enabled ? 1 : 0, now).run();
      return json({ channel: body.channel, enabled: body.enabled, updated_at: now });
    }
    if (request.method === "GET" && action === "policies") {
      if (userRole !== "admin" && userRole !== "operations") return fail("Forbidden", 403);
      const result = await env.DB.prepare(`SELECT policy_key,enabled FROM community_policies WHERE community_id=? ORDER BY policy_key`).bind(communityId).all();
      return json(result.results);
    }
    if (request.method === "PATCH" && action === "policies") {
      if (userRole !== "admin" && userRole !== "operations") return fail("Forbidden", 403);
      const body = await request.json().catch(() => null);
      const allowedPolicies = ["permit_time_window", "resident_ownership_scope", "gate_value_validation", "resident_vehicle_scope", "parking_unit_validation"];
      if (!body?.policy_key || !allowedPolicies.includes(body.policy_key) || typeof body.enabled !== "boolean") return fail("Invalid policy update");
      await env.DB.prepare(`INSERT INTO community_policies (community_id,policy_key,enabled) VALUES (?,?,?) ON CONFLICT(community_id,policy_key) DO UPDATE SET enabled=excluded.enabled`).bind(communityId, body.policy_key, body.enabled ? 1 : 0).run();
      await env.DB.prepare(`INSERT INTO audit_events (id,community_id,actor_user_id,action,entity_type,entity_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(), communityId, user.id, "policy.update", "community_policy", body.policy_key, JSON.stringify({enabled:body.enabled}), new Date().toISOString()).run();
      return json({ policy_key: body.policy_key, enabled: body.enabled });
    }
    if (request.method === "GET" && action === "settings") {
      if (userRole !== "admin" && userRole !== "operations") return fail("Forbidden", 403);
      const result = await env.DB.prepare(`SELECT setting_key,setting_value FROM community_settings WHERE community_id=? ORDER BY setting_key`).bind(communityId).all();
      return json(result.results);
    }
    if (request.method === "PATCH" && action === "settings") {
      if (userRole !== "admin" && userRole !== "operations") return fail("Forbidden", 403);
      const body = await request.json().catch(() => null);
      const allowedModes = ["qr_only", "tag_only", "qr_or_tag", "anpr_only", "hybrid"];
      if (body?.setting_key !== "access_verification_mode" || !allowedModes.includes(body.setting_value)) return fail("Invalid access verification mode");
      await env.DB.prepare(`INSERT INTO community_settings (community_id,setting_key,setting_value) VALUES (?,?,?) ON CONFLICT(community_id,setting_key) DO UPDATE SET setting_value=excluded.setting_value`).bind(communityId, body.setting_key, body.setting_value).run();
      await env.DB.prepare(`INSERT INTO audit_events (id,community_id,actor_user_id,action,entity_type,entity_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(), communityId, user.id, "setting.update", "community_setting", body.setting_key, JSON.stringify({value:body.setting_value}), new Date().toISOString()).run();
      return json({ setting_key: body.setting_key, setting_value: body.setting_value });
    }
    if (request.method === "GET" && action === "modules") {
      if (userRole !== "admin" && userRole !== "operations") return fail("Forbidden", 403);
      const result = await env.DB.prepare(`SELECT module_key,status,configuration_json,updated_at FROM community_modules WHERE community_id=? ORDER BY module_key`).bind(communityId).all();
      return json(result.results);
    }
    if (request.method === "PATCH" && action === "modules") {
      if (userRole !== "admin" && userRole !== "operations") return fail("Forbidden", 403);
      const body = await request.json().catch(() => null);
      const allowed = ["core_identity", "access_security", "vehicles_parking", "permits_visitors", "maintenance", "information_center", "unit_mailbox", "leases", "lease_payments", "facilities_activities", "commercial_operations", "reports_integrations"];
      if (!body?.module_key || !allowed.includes(body.module_key) || !["enabled", "disabled", "pilot"].includes(body.status)) return fail("Invalid module configuration");
      const now = new Date().toISOString();
      const config = body.configuration == null ? null : JSON.stringify(body.configuration);
      await env.DB.prepare(`INSERT INTO community_modules (community_id,module_key,status,configuration_json,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(community_id,module_key) DO UPDATE SET status=excluded.status,configuration_json=excluded.configuration_json,updated_at=excluded.updated_at`).bind(communityId, body.module_key, body.status, config, now).run();
      await env.DB.prepare(`INSERT INTO audit_events (id,community_id,actor_user_id,action,entity_type,entity_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(), communityId, user.id, "module.update", "community_module", body.module_key, JSON.stringify({status:body.status}), now).run();
      return json({ module_key: body.module_key, status: body.status, updated_at: now });
    }
    if (request.method === "GET" && action === "leases") {
      if (!["admin", "operations", "security", "resident"].includes(userRole)) return fail("Forbidden", 403);
      const residentScope = userRole === "resident" ? " AND lessee_user_id=?" : "";
      const params = userRole === "resident" ? [communityId, user.id] : [communityId];
      const result = await env.DB.prepare(`SELECT id,subject_type,subject_id,lessor_name,lessor_type,lessee_name,lessee_user_id,starts_at,ends_at,status,rent_amount,rent_currency,created_at FROM leases WHERE community_id=?${residentScope} ORDER BY starts_at DESC`).bind(...params).all();
      return json(result.results);
    }
    if (request.method === "POST" && action === "leases") {
      if (userRole !== "admin" && userRole !== "operations") return fail("Forbidden", 403);
      const body = await request.json().catch(() => null);
      const allowedSubjects = ["residential_unit", "commercial_unit"];
      const allowedLessorTypes = ["community_owner", "external_owner"];
      const allowedStatuses = ["draft", "active", "expired", "terminated"];
      if (!body?.subject_type || !allowedSubjects.includes(body.subject_type) || !body?.subject_id || !body?.lessor_name || !body?.lessee_name || !body?.starts_at) return fail("Lease fields are incomplete");
      if (body.lessor_type && !allowedLessorTypes.includes(body.lessor_type)) return fail("Invalid lessor type");
      if (body.status && !allowedStatuses.includes(body.status)) return fail("Invalid lease status");
      const starts = new Date(body.starts_at).getTime();
      const ends = body.ends_at ? new Date(body.ends_at).getTime() : null;
      if (!Number.isFinite(starts) || (body.ends_at && (!Number.isFinite(ends) || ends <= starts))) return fail("Lease time range is invalid");
      const table = body.subject_type === "residential_unit" ? "units" : "commercial_units";
      const subject = await env.DB.prepare(`SELECT id FROM ${table} WHERE id=? AND community_id=?`).bind(body.subject_id, communityId).first();
      if (!subject) return fail("Lease subject not found in this community", 404);
      if (body.lessee_user_id) {
        const lessee = await env.DB.prepare(`SELECT id FROM users WHERE id=? AND community_id=?`).bind(body.lessee_user_id, communityId).first();
        if (!lessee) return fail("Lessee user not found in this community", 404);
      }
      const id = crypto.randomUUID();
      await env.DB.prepare(`INSERT INTO leases (id,community_id,subject_type,subject_id,lessor_name,lessor_type,lessee_name,lessee_user_id,starts_at,ends_at,status,rent_amount,rent_currency,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, communityId, body.subject_type, body.subject_id, body.lessor_name, body.lessor_type || "community_owner", body.lessee_name, body.lessee_user_id || null, body.starts_at, body.ends_at || null, body.status || "active", body.rent_amount ?? null, body.rent_currency || "EGP", new Date().toISOString()).run();
      await env.DB.prepare(`INSERT INTO audit_events (id,community_id,actor_user_id,action,entity_type,entity_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(), communityId, user.id, "lease.create", "lease", id, JSON.stringify({subject_type:body.subject_type,subject_id:body.subject_id}), new Date().toISOString()).run();
      return json({ id, status: body.status || "active" }, 201);
    }
    if (request.method === "GET" && action === "lease-payments") {
      if (!["admin", "operations", "security", "resident"].includes(userRole)) return fail("Forbidden", 403);
      const residentScope = userRole === "resident" ? " AND l.lessee_user_id=?" : "";
      const params = userRole === "resident" ? [communityId, user.id] : [communityId];
      const result = await env.DB.prepare(`SELECT p.id,p.lease_id,p.due_date,p.amount,p.currency,CASE WHEN p.status='due' AND p.due_date < date('now') THEN 'late' ELSE p.status END AS status,p.paid_at,p.payment_method,p.payment_reference,p.reminder_sent_at FROM lease_payments p JOIN leases l ON l.id=p.lease_id WHERE p.community_id=?${residentScope} ORDER BY p.due_date`).bind(...params).all();
      return json(result.results);
    }
    if (request.method === "POST" && action === "lease-payments") {
      if (userRole !== "admin" && userRole !== "operations") return fail("Forbidden", 403);
      const body = await request.json().catch(() => null);
      if (!body?.lease_id || !body?.due_date || !Number.isFinite(Number(body.amount)) || Number(body.amount) <= 0) return fail("Payment schedule fields are incomplete");
      const lease = await env.DB.prepare(`SELECT id FROM leases WHERE id=? AND community_id=?`).bind(body.lease_id, communityId).first();
      if (!lease) return fail("Lease not found", 404);
      if (body.status && !["due", "paid", "late", "waived"].includes(body.status)) return fail("Invalid payment status");
      const id = crypto.randomUUID();
      await env.DB.prepare(`INSERT INTO lease_payments (id,community_id,lease_id,due_date,amount,currency,status,paid_at,payment_method,payment_reference,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(id, communityId, body.lease_id, body.due_date, Number(body.amount), body.currency || "EGP", body.status || "due", body.paid_at || null, body.payment_method || null, body.payment_reference || null, new Date().toISOString()).run();
      return json({ id, status: body.status || "due" }, 201);
    }
    if (request.method === "PATCH" && action === "lease-payments") {
      if (userRole !== "admin" && userRole !== "operations") return fail("Forbidden", 403);
      const body = await request.json().catch(() => null);
      if (!body?.payment_id || !["paid", "due", "late", "waived"].includes(body.status)) return fail("Payment update is invalid");
      const paidAt = body.status === "paid" ? (body.paid_at || new Date().toISOString()) : null;
      await env.DB.prepare(`UPDATE lease_payments SET status=?,paid_at=?,payment_method=?,payment_reference=? WHERE id=? AND community_id=?`).bind(body.status, paidAt, body.payment_method || null, body.payment_reference || null, body.payment_id, communityId).run();
      return json({ id: body.payment_id, status: body.status, paid_at: paidAt });
    }
    if (request.method === "GET" && action === "commercial-units") {
      if (userRole !== "admin" && userRole !== "operations" && userRole !== "security") return fail("Forbidden", 403);
      const result = await env.DB.prepare(`SELECT id,code,tenant_name,category,status,lease_start,lease_end FROM commercial_units WHERE community_id=? ORDER BY code`).bind(communityId).all();
      return json(result.results);
    }
    if (request.method === "POST" && action === "commercial-units") {
      if (userRole !== "admin" && userRole !== "operations") return fail("Forbidden", 403);
      const body = await request.json().catch(() => null);
      if (!body?.code || !body?.tenant_name) return fail("Commercial unit code and tenant are required");
      const id = crypto.randomUUID();
      await env.DB.prepare(`INSERT INTO commercial_units (id,community_id,code,tenant_name,category,status,lease_start,lease_end) VALUES (?,?,?,?,?,?,?,?)`).bind(id, communityId, body.code, body.tenant_name, body.category || null, body.status || "active", body.lease_start || null, body.lease_end || null).run();
      return json({ id, status: body.status || "active" }, 201);
    }
    if (request.method === "GET" && action === "loading-slots") {
      if (userRole !== "admin" && userRole !== "operations" && userRole !== "security") return fail("Forbidden", 403);
      const result = await env.DB.prepare(`SELECT id,code,zone,booking_mode,status FROM loading_slots WHERE community_id=? ORDER BY code`).bind(communityId).all();
      return json(result.results);
    }
    if (request.method === "POST" && action === "loading-bookings") {
      if (userRole !== "admin" && userRole !== "operations" && userRole !== "security") return fail("Forbidden", 403);
      const body = await request.json().catch(() => null);
      if (!body?.loading_slot_id || !body?.carrier_name || !body?.starts_at || !body?.ends_at) return fail("Loading booking fields are incomplete");
      const starts = new Date(body.starts_at).getTime();
      const ends = new Date(body.ends_at).getTime();
      if (!Number.isFinite(starts) || !Number.isFinite(ends) || ends <= starts) return fail("Loading booking time range is invalid");
      const slot = await env.DB.prepare(`SELECT id,status FROM loading_slots WHERE id=? AND community_id=?`).bind(body.loading_slot_id, communityId).first();
      if (!slot || slot.status !== "active") return fail("Loading slot not found or inactive", 404);
      const id = crypto.randomUUID();
      await env.DB.prepare(`INSERT INTO loading_bookings (id,community_id,loading_slot_id,commercial_unit_id,carrier_name,vehicle_plate,starts_at,ends_at,status,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(id, communityId, body.loading_slot_id, body.commercial_unit_id || null, body.carrier_name, body.vehicle_plate || null, body.starts_at, body.ends_at, "requested", user.id, new Date().toISOString()).run();
      return json({ id, status: "requested" }, 201);
    }
    return fail("Not found", 404);
  }
};

