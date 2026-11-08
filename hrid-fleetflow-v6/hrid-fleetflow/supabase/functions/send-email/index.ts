// Supabase Edge Function: sends HRID FleetFlow notification emails through Microsoft 365 (Microsoft Graph).
// Triggered by a Database Webhook on INSERT into public.email_outbox. Emails are rebuilt from the database,
// so the function cannot be used to send arbitrary emails.
// Secrets: MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET, MS_SENDER (shared mailbox), APP_URL, WEBHOOK_SECRET.
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildEmails } from "../_shared/emails.js";

const env = (k: string) => Deno.env.get(k) ?? "";
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));

async function graphToken() {
  const res = await fetch(`https://login.microsoftonline.com/${env("MS_TENANT_ID")}/oauth2/v2.0/token`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env("MS_CLIENT_ID"), client_secret: env("MS_CLIENT_SECRET"), scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" }),
  });
  if (!res.ok) throw new Error("Token error: " + (await res.text()));
  return (await res.json()).access_token as string;
}
async function sendMail(token: string, to: string, subject: string, html: string) {
  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(env("MS_SENDER"))}/sendMail`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { subject, body: { contentType: "HTML", content: html }, toRecipients: [{ emailAddress: { address: to } }] }, saveToSentItems: true }),
  });
  if (!res.ok) throw new Error(`sendMail ${res.status}: ${await res.text()}`);
}

Deno.serve(async (req) => {
  if (req.headers.get("x-webhook-secret") !== env("WEBHOOK_SECRET")) return new Response("Forbidden", { status: 403 });
  const payload = await req.json();
  const job = payload.record?.data, jobId = payload.record?.id;
  if (!job?.event) return new Response("Ignored", { status: 200 });
  const load = async (t: string, id: string) => (await db.from(t).select("data").eq("id", id).maybeSingle()).data?.data ?? null;
  try {
    const users = ((await db.from("users").select("data")).data ?? []).map((r: any) => r.data);
    const byId = (id?: string) => users.find((u: any) => u.id === id) ?? null;
    const admins = users.filter((u: any) => u.role === "admin" && u.active !== false && u.email);
    let emails;
    if (job.event === "vehicle_issue") {
      const issues = (await Promise.all((job.issue_ids ?? []).map((id: string) => load("vehicle_issues", id)))).filter(Boolean);
      emails = buildEmails("vehicle_issue", { issues, admins, appUrl: env("APP_URL") });
    } else {
      const request = await load("trip_requests", job.request_id);
      if (!request) throw new Error("Request not found");
      emails = buildEmails(job.event, { request, admins, appUrl: env("APP_URL"),
        requesterEmail: request.for_guest ? request.guest_email : byId(request.requester_id)?.email,
        driver: byId(request.assigned_driver_id), previousDriver: byId(job.previous_driver_id) });
    }
    const token = await graphToken();
    for (const m of emails) await sendMail(token, m.to, m.subject, m.html);
    await db.from("email_outbox").update({ data: { ...job, status: "sent", sent_to: emails.map((m: any) => m.to), sent_at: new Date().toISOString() } }).eq("id", jobId);
    return new Response(JSON.stringify({ sent: emails.length }), { status: 200 });
  } catch (e) {
    await db.from("email_outbox").update({ data: { ...job, status: "failed", error: String(e) } }).eq("id", jobId);
    return new Response(String(e), { status: 500 });
  }
});
