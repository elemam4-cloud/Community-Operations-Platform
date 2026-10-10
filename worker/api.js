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
      const result = await env.DB.prepare(`SELECT id,code,zone,parking_type,assigned_unit_id,access_control,status FROM parking_spaces WHERE community_id=? ORDER BY code`).bind(communityId).all();
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
      const result = await env.DB.prepare(`SELECT id,title,body,audience,published_at,created_at FROM announcements WHERE community_id=? AND published_at IS NOT NULL ORDER BY published_at DESC LIMIT 100`).bind(communityId).all();
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
      const space = await env.DB.prepare(`SELECT id,status FROM parking_spaces WHERE id=? AND community_id=?`).bind(body.parking_space_id, communityId).first();
      if (!space) return fail("Parking space not found", 404);
      if (space.status === "assigned") return fail("Parking space is already assigned", 409);
      if (await policy(env.DB, communityId, "parking_unit_validation")) {
        const unit = await env.DB.prepare(`SELECT id FROM units WHERE id=? AND community_id=?`).bind(body.unit_id, communityId).first();
        if (!unit) return fail("Unit not found", 404);
      }
      await env.DB.prepare(`UPDATE parking_spaces SET assigned_unit_id=?,status='assigned' WHERE id=? AND community_id=?`).bind(body.unit_id, body.parking_space_id, communityId).run();
      await env.DB.prepare(`INSERT INTO audit_events (id,community_id,actor_user_id,action,entity_type,entity_id,created_at) VALUES (?,?,?,?,?,?,?)`).bind(crypto.randomUUID(), communityId, user.id, "parking.assign", "parking_space", body.parking_space_id, new Date().toISOString()).run();
      return json({ id: body.parking_space_id, status: "assigned" }, 201);
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
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await env.DB.prepare(`INSERT INTO announcements (id,community_id,author_id,title,body,audience,published_at,created_at) VALUES (?,?,?,?,?,?,?,?)`).bind(id, communityId, user.id, body.title, body.body, body.audience || "all", now, now).run();
      const recipients = await env.DB.prepare(`SELECT id FROM users WHERE community_id=? AND status='active'`).bind(communityId).all();
      for (const recipient of recipients.results || []) {
        await env.DB.prepare(`INSERT INTO notifications (id,community_id,user_id,announcement_id,channel,delivery_status,created_at) VALUES (?,?,?,?,?,?,?)`).bind(crypto.randomUUID(), communityId, recipient.id, id, "in_app", "pending", now).run();
      }
      await env.DB.prepare(`INSERT INTO audit_events (id,community_id,actor_user_id,action,entity_type,entity_id,created_at) VALUES (?,?,?,?,?,?,?)`).bind(crypto.randomUUID(), communityId, user.id, "announcement.publish", "announcement", id, now).run();
      return json({ id, published_at: now }, 201);
    }
    if (request.method === "GET" && action === "notifications") {
      const result = await env.DB.prepare(`SELECT id,channel,delivery_status,read_at,created_at FROM notifications WHERE community_id=? AND user_id=? ORDER BY created_at DESC LIMIT 100`).bind(communityId, user.id).all();
      return json(result.results);
    }
    if (request.method === "PATCH" && action === "notifications") {
      const body = await request.json().catch(() => null);
      if (!body?.notification_id) return fail("Notification is required");
      const now = new Date().toISOString();
      await env.DB.prepare(`UPDATE notifications SET read_at=? WHERE id=? AND community_id=? AND user_id=?`).bind(now, body.notification_id, communityId, user.id).run();
      return json({ id: body.notification_id, read_at: now });
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
    return fail("Not found", 404);
  }
};

