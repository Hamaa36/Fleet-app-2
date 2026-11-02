# HRID FleetFlow

Trip requests, driver assignment, passenger signatures and weekly vehicle checklists for
**Hiwa Rauf for Investment & Development**. Plain HTML/CSS/JavaScript – no build step.

## Roles
| Role | Can do |
|---|---|
| Administrator (Kaiwan Abdalla Salih, Omed Mustafa Ahmed) | Approve/reject requests (incl. guests), assign driver + company vehicle, all trips, checklists, users, email log |
| Driver | Weekly safety & maintenance checklist (every Sunday 08:00 Iraq time), assigned trips, record trips with passenger signatures |
| Employee | Request trips, track and cancel pending requests |
| Guest (no account) | "Request a trip as a guest" on the sign-in page – always needs admin approval |

## Trip requests
- **Multiple destinations** – add up to 10 stops in order (pick-up → destination 1 → 2 → …).
- **"I am a passenger"** checkbox for the person requesting.
- **Passengers** – add as many as needed; each one is either an **HRID employee** (picked from the employee drop-down)
  or **Non-HRID** (name + company typed in). Guests can only add non-HRID passengers (the employee list is not shown publicly).
- When a driver starts an assigned trip, the stops and passengers are copied into the trip form for signatures.

## Language – English / کوردی (Sorani)
The **کوردی / English** button (sign-in page, header of every page, and Profile) switches the whole app to
Kurdish Central with a right-to-left layout and Kurdish dates. The choice is remembered on each phone.
Translations are in `js/i18n.js` – edit the `KU` list to change any wording. Names, emails, places and plates are not translated.
Notification emails are still sent in English.

## Company vehicles
Listed in `js/fleet.js` (9 vehicles). Used for admin assignment, trip forms, weekly checklists and drivers' default vehicle.
Edit that file when vehicles are added or sold.

## Sign-in
Employee number **or** email + password. First password = date of birth as DDMMYYYY (08/09/2003 → 08092003).
Everyone must choose a new password at first sign-in.

## Adding the users
On first open choose **Import employees from CSV** and select `hrid-users-import.csv`
(kept outside this folder – **never upload it to GitHub**, it contains birth dates).
Later imports update names/emails/roles by employee number and keep existing passwords.
Columns: `employee_no, full_name, birth_date, email, role` (role = admin | driver | requester).

## Emails (Microsoft 365)
| Event | Emailed to |
|---|---|
| New request | Requester (confirmation) + all admins (action required) |
| Approved | Requester + assigned driver (previous driver if reassigned) |
| Rejected | Requester (+ driver if one had been assigned) |
| Cancelled by requester | Admins |

The app writes each event to `email_outbox`; the Supabase function `send-email` builds the email and sends it
from an HRID shared mailbox through Microsoft Graph. Until connected, **Users → Email log** shows what would be sent.

### Email setup (needs the Microsoft 365 / Exchange admin)
1. Create a shared mailbox, e.g. `fleet@hiwarauf.com`.
2. Entra admin center → App registrations → New: copy *Tenant ID*, *Client ID*, create a *Client secret*.
3. Limit the app to that mailbox only (Exchange Online PowerShell):
   ```powershell
   New-ServicePrincipal -AppId <ClientID> -ObjectId <EnterpriseAppObjectID> -DisplayName "HRID FleetFlow"
   New-ManagementScope -Name "FleetFlow mailbox" -RecipientRestrictionFilter "PrimarySmtpAddress -eq 'fleet@hiwarauf.com'"
   New-ManagementRoleAssignment -App <EnterpriseAppObjectID> -Role "Application Mail.Send" -CustomResourceScope "FleetFlow mailbox"
   ```
   Do **not** also grant Mail.Send in Entra ID – that would allow sending as any mailbox.
4. Deploy the function (from this folder, Node.js installed):
   ```
   npx supabase login
   npx supabase link --project-ref <project-id>
   npx supabase functions deploy send-email --no-verify-jwt
   npx supabase secrets set MS_TENANT_ID=... MS_CLIENT_ID=... MS_CLIENT_SECRET=... MS_SENDER=fleet@hiwarauf.com APP_URL=https://... WEBHOOK_SECRET=<long random text>
   ```
5. Supabase → Database → Webhooks → Create: table `email_outbox`, event **Insert**, type *Supabase Edge Function* → `send-email`,
   HTTP header `x-webhook-secret: <same WEBHOOK_SECRET>`.

## Hosting
1. **Supabase**: new project → SQL Editor → run `supabase/schema.sql` → copy Project URL + anon key into `config.js`.
2. **GitHub**: private repository → upload everything in this folder.
3. **Azure Static Web Apps** (Free plan): source GitHub → repo → branch `main` → build preset *Custom*, app location `/`, output empty.
4. Put the site address in `config.js` → `APP_URL`. Optional: custom domain (e.g. fleet.hiwarauf.com) and a Teams tab.

## Security – read before going live
Login is checked in the browser and the database is reachable with the public anon key. Anyone who has the
site address and key could read the tables. Fine for a pilot; for production move sign-in to Supabase Auth or
Microsoft Entra ID and tighten the row-level security policies. Keep the repository private.

## Customise
Kurdish wording `js/i18n.js` · vehicles `js/fleet.js` · checklist items `js/checklist.js` · due day/time `config.js` · colours `styles.css` ·
email texts `supabase/functions/_shared/emails.js`
