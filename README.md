# HRID FleetFlow (v6)

Company transport for **Hiwa Rauf for Investment & Development**: requests, approvals, step-by-step trips with
time + GPS at every location, weekly vehicle checklists, vehicle problem alerts and in-depth monthly reports.
Plain HTML/CSS/JavaScript – no build step.

## ⚠ When updating from an older version
1. Run `supabase/schema.sql` again in **Supabase → SQL Editor → Run** (safe; keeps data).
2. Replace all files in GitHub with this folder. `config.js` already contains the Supabase key and site address.
Old test trips from v5 and earlier are not shown in v6 (the trip is now stored on the request itself).

## Roles
| Role | What they do |
|---|---|
| Employee | **Request transport** (people or documents & items), follow status, sign deliveries on their own phone |
| Administrator | Dashboard with status board, approve / reject / assign, **request for guests**, vehicles & problems, reports, users |
| Driver | Next trips → **Start trip** → tap **Arrived** at every stop → passengers sign → **Finish trip**; weekly checklist; report problems |

Guests no longer have a public page – only administrators create guest requests (New request → Who is it for? → Guest).

## Trip statuses
Pending approval → Approved → In progress → (items: Awaiting signature) → Completed. Also Rejected / Cancelled.
The admin dashboard shows one tile per status; tap a tile to see those trips.

## Locations
Time and GPS are recorded at: departure, every destination, the return to pick-up (when a return time is set),
every passenger signature, the requester's delivery signature, the end of the trip, weekly checklists and problem reports.
If the phone's location is off, the app explains how to turn it on and offers *Try again* or *Record without location*
(those are marked "No location" in reports).

## Monthly reports (Admin → Reports)
Tabs: **Overview** (16 key figures vs last month, trips per day, status, people/items, weekday, departure hour) ·
**Trips** (top destinations, departments, every trip with times, map links, punctuality, duration, km) ·
**Vehicles** (km, % of days used, summary table) · **Drivers** (trips, hours, on-time %, checklists) ·
**Departments** · **Problems** (type, severity, time to fix) · **Export** (10 CSV files for Excel, or all at once).
**Print / Save as PDF** prints every tab. "On time" = left no more than `ON_TIME_MINUTES` (config.js, default 15) after the planned time.

## Sign-in & users
Employee number or email + password. First password = date of birth DDMMYYYY; must be changed at first sign-in.
Users → Import CSV (`employee_no, full_name, birth_date, email, role, department`). Never upload the staff CSV to GitHub.

## Emails (Microsoft 365)
New request → admins (+ requester) · Approved → requester + driver · Rejected / cancelled → requester / admins / driver ·
Trip started → requester · Delivered → requester (please sign) · Signed → admins · Vehicle problem → all admins (URGENT if unsafe).
Until Microsoft 365 is connected, **Users → Email log** shows what would be sent.
Setup (Microsoft 365 / Exchange admin):
1. Shared mailbox, e.g. `fleet@hiwarauf.com`. 2. Entra → App registrations → New (Tenant ID, Client ID, Client secret).
3. Limit it to that mailbox (Exchange Online PowerShell):
   ```powershell
   New-ServicePrincipal -AppId <ClientID> -ObjectId <EnterpriseAppObjectID> -DisplayName "HRID FleetFlow"
   New-ManagementScope -Name "FleetFlow mailbox" -RecipientRestrictionFilter "PrimarySmtpAddress -eq 'fleet@hiwarauf.com'"
   New-ManagementRoleAssignment -App <EnterpriseAppObjectID> -Role "Application Mail.Send" -CustomResourceScope "FleetFlow mailbox"
   ```
4. From this folder: `npx supabase login` · `npx supabase link --project-ref lewsgbsvihjoqkanlwcb` · `npx supabase functions deploy send-email --no-verify-jwt` ·
   `npx supabase secrets set MS_TENANT_ID=... MS_CLIENT_ID=... MS_CLIENT_SECRET=... MS_SENDER=fleet@hiwarauf.com APP_URL=https://hamaa36.github.io/Fleet-app-2/ WEBHOOK_SECRET=<random>`
5. Supabase → Database → Webhooks: table `email_outbox`, Insert, Edge Function `send-email`, header `x-webhook-secret`.

## Language
کوردی / English button on every page (right-to-left in Kurdish). Wording: `js/i18n.js`.

## Files
`js/requests.js` request form, dashboards, approval · `js/run.js` driver trip, checklist, problems · `js/reports.js` reports ·
`js/admin.js` vehicles, users, profile · `js/fleet.js` vehicles · `js/checklist.js` checklist items · `config.js` settings.

## Security
Sign-in is checked in the browser and the database is reachable with the public anon key. Fine for a pilot; for real
staff data keep the repository private (Azure Static Web Apps) and move sign-in to Supabase Auth or Microsoft Entra ID.
