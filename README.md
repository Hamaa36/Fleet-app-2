# HRID FleetFlow

Trip & delivery requests, driver assignment, passenger signatures, arrival times, weekly vehicle checklists,
vehicle problem reports and monthly reports for **Hiwa Rauf for Investment & Development**.
Plain HTML/CSS/JavaScript – no build step.

## ⚠ After updating to this version
Run `supabase/schema.sql` again in **Supabase → SQL Editor → Run**. It adds the new `vehicle_issues` table
and is safe to run more than once (existing data is kept).

## Roles
| Role | Can do |
|---|---|
| Administrator | Approve/reject requests, assign driver + vehicle, all trips, vehicle problems, checklists, monthly reports, users, email log |
| Driver | Weekly checklist (every Sunday 08:00 Iraq time), report vehicle problems any time, assigned trips, arrival times, passenger signatures |
| Employee | Request trips for **passengers** or **documents & items**, sign deliveries on their own phone |
| Guest (no account) | "Request a trip as a guest" on the sign-in page (passengers only) – always needs admin approval |

## Request types
- **Passengers** – multiple destinations, "I am a passenger" checkbox, HRID employees from a drop-down or non-HRID people typed in.
  Every passenger signs on the driver's phone.
- **Documents & items** – list of items with quantities, receiver name/phone. No passenger signatures.
  When the driver submits the delivery, the requester gets an email and signs **on their own phone** (My requests → Confirm & sign).
  Status: Approved → Awaiting signature → Completed.

## Arrival times
In every trip the driver taps **Record departure** at the pick-up and **Record arrival** at each destination.
Time and GPS location are saved and shown in the trip report, the monthly report and the CSV export.

## Vehicle problems
- Every "Needs attention" item in the weekly checklist becomes a vehicle problem.
- Drivers (and admins) can use **Report vehicle problem** at any time: type, severity (minor / major / unsafe), description.
- All administrators are emailed immediately. Unsafe problems show a red alert on the admin dashboard and when assigning that vehicle.
- Admins mark problems as resolved with the repair/action taken (Vehicles page).

## Monthly reports (Admin → Reports)
Pick a month to see: key figures, trips per day, requests by status, trip type, distance per vehicle, trips per driver,
problems per vehicle, a vehicle information table, all vehicle problems & defects and all trips with arrival times.
**Print / Save as PDF**, and **raw data export** as CSV (opens in Excel, Kurdish text included):
trips, stops & arrival times, passengers, documents & items, requests, vehicle information, vehicle problems, weekly checklists.

## Language – English / کوردی (Sorani)
The **کوردی / English** button (sign-in page, header, Profile) switches the whole app to Kurdish Central with a
right-to-left layout. Translations: `js/i18n.js`. Names, emails, places and plates are not translated. Emails are in English.

## Company vehicles
Listed in `js/fleet.js` (9 vehicles). Edit that file when vehicles are added or sold.

## Sign-in
Employee number **or** email + password. First password = date of birth as DDMMYYYY (08/09/2003 → 08092003).
Everyone must choose a new password at first sign-in.

## Adding users
First screen → **Import employees from CSV** (or Users → Import CSV). Columns: `employee_no, full_name, birth_date, email, role`
(role = admin | driver | requester). **Never upload the staff CSV to GitHub** – it contains birth dates.

## Emails (Microsoft 365)
| Event | Emailed to |
|---|---|
| New request | Requester + all admins |
| Approved | Requester + assigned driver (previous driver if reassigned) |
| Rejected / cancelled | Requester / admins (+ driver if assigned) |
| Vehicle problem reported | All admins (marked URGENT when unsafe) |
| Delivery done | Requester – please sign |
| Delivery signed | All admins |

Until the Microsoft 365 connection is set up, **Users → Email log** shows exactly what would be sent.
Setup (needs the Microsoft 365 / Exchange admin):
1. Create a shared mailbox, e.g. `fleet@hiwarauf.com`.
2. Entra admin center → App registrations → New: copy *Tenant ID*, *Client ID*, create a *Client secret*.
3. Limit the app to that mailbox only (Exchange Online PowerShell):
   ```powershell
   New-ServicePrincipal -AppId <ClientID> -ObjectId <EnterpriseAppObjectID> -DisplayName "HRID FleetFlow"
   New-ManagementScope -Name "FleetFlow mailbox" -RecipientRestrictionFilter "PrimarySmtpAddress -eq 'fleet@hiwarauf.com'"
   New-ManagementRoleAssignment -App <EnterpriseAppObjectID> -Role "Application Mail.Send" -CustomResourceScope "FleetFlow mailbox"
   ```
4. Deploy the function (from this folder, Node.js installed):
   ```
   npx supabase login
   npx supabase link --project-ref lewsgbsvihjoqkanlwcb
   npx supabase functions deploy send-email --no-verify-jwt
   npx supabase secrets set MS_TENANT_ID=... MS_CLIENT_ID=... MS_CLIENT_SECRET=... MS_SENDER=fleet@hiwarauf.com APP_URL=https://hamaa36.github.io/Fleet-app-2/ WEBHOOK_SECRET=<long random text>
   ```
5. Supabase → Database → Webhooks → Create: table `email_outbox`, event **Insert**, type *Supabase Edge Function* → `send-email`,
   HTTP header `x-webhook-secret: <same WEBHOOK_SECRET>`.

## Hosting
- **GitHub Pages** (testing): repository must be public on a free account → Settings → Pages → main / root.
- **Azure Static Web Apps** (recommended for real use, repository can stay private): Free plan, source GitHub, build preset *Custom*, app location `/`.

## Security – read before going live
Sign-in is checked in the browser and the database is reachable with the public anon key. Anyone who has the
site address and key could read the tables. Fine for a pilot; for production move sign-in to Supabase Auth or
Microsoft Entra ID and tighten the row-level security policies. Keep the repository private for real staff data.

## Customise
Kurdish wording `js/i18n.js` · vehicles `js/fleet.js` · checklist items & problem types `js/checklist.js` ·
due day/time `config.js` · colours `styles.css` · email texts `supabase/functions/_shared/emails.js`
