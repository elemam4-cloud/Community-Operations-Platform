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
      const result = await env.DB.prepare(`SELECT id,plate_number,access_tag,status,primary_user_id FROM vehicles WHERE community_id=? ORDER BY plate_number`).bind(communityId).all();
      return json(result.results);
    }
    if (request.method === "POST" && action === "permits") {
      if (!can(userRole, "permit")) return fail("Forbidden", 403);
      const body = await request.json().catch(() => null);
      if (!body?.subject_name || !body?.permit_type || !body?.starts_at || !body?.expires_at) return fail("Permit fields are incomplete");
      const id = crypto.randomUUID();
      await env.DB.prepare(`INSERT INTO permits (id,community_id,issued_by,unit_id,vehicle_id,subject_name,permit_type,starts_at,expires_at,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(id, communityId, user.id, body.unit_id || null, body.vehicle_id || null, body.subject_name, body.permit_type, body.starts_at, body.expires_at, "active", new Date().toISOString()).run();
      await env.DB.prepare(`INSERT INTO audit_events (id,community_id,actor_user_id,action,entity_type,entity_id,created_at) VALUES (?,?,?,?,?,?,?)`).bind(crypto.randomUUID(), communityId, user.id, "permit.issue", "permit", id, new Date().toISOString()).run();
      return json({ id, status: "active" }, 201);
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
    return fail("Not found", 404);
  }
};

