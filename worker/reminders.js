// Scheduled lease reminder job. It is intentionally provider-neutral.
// Run it from a scheduler outside Sites or from a Cloudflare Worker cron trigger.

export async function processLeaseReminders(db, now = new Date(), windowDays = 3) {
  const nowIso = new Date(now).toISOString();
  const until = new Date(new Date(now).getTime() + windowDays * 86400000).toISOString().slice(0, 10);
  const rows = await db.prepare(`SELECT p.id,p.community_id,p.lease_id,p.due_date,p.amount,p.currency,p.status,l.lessee_user_id,u.id AS user_id FROM lease_payments p JOIN leases l ON l.id=p.lease_id JOIN users u ON u.id=l.lessee_user_id WHERE p.status IN ('due','late') AND p.reminder_sent_at IS NULL AND p.due_date<=?`).bind(until).all();
  let queued = 0;
  for (const row of rows.results || []) {
    const late = row.due_date < nowIso.slice(0, 10);
    const id = crypto.randomUUID();
    await db.prepare(`INSERT INTO notifications (id,community_id,user_id,announcement_id,channel,delivery_status,created_at) VALUES (?,?,?,?,?,?,?)`).bind(id, row.community_id, row.user_id, null, "in_app", "pending", nowIso).run();
    await db.prepare(`UPDATE lease_payments SET status=CASE WHEN status='due' AND due_date<? THEN 'late' ELSE status END,reminder_sent_at=? WHERE id=? AND reminder_sent_at IS NULL`).bind(nowIso.slice(0, 10), nowIso, row.id).run();
    queued += 1;
  }
  return { queued, scanned: (rows.results || []).length };
}

