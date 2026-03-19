# Product context for branding

Use this in another chat so they understand the product before working through naming, voice, and visual identity.

---

## What it is

A **booking platform for service businesses** (salons, studios, one-person shops). Right now it’s built and live for one client: **DUST Hair Studio** (LA-based hair studio). The goal is to turn it into a **multitenant product** so many businesses can use it.

- **Customers (end users):** Book appointments, see their appointments, get confirmations and reminders. Can book as guest or with an account. Pricing can differ for “new” vs “loyalty” customers.
- **Businesses (your clients):** Get an admin dashboard: bookings, customers, services, schedule (business hours + Google Calendar), optional waitlist, email campaigns (segments + blasts), and payments (today: their Square; later possibly you process). They manage everything in your app.

So it’s **B2B2C**: you sell to the business; the business’s customers use the booking flow.

---

## How it works today (single tenant)

- One business (DUST) uses the app. Their customers go to the same app URL, log in (or not), pick a service, pick date/time, enter details, confirm. No payment at booking; payment links or Square POS after the appointment.
- Business hours and Google Calendar drive availability. Admins manage services (with dual pricing for new vs existing customers), customers, campaigns, and settings (business info, timezone, Square, Resend, etc.).

---

## Where it’s going (multitenant)

- **Many businesses**, each with their own data (bookings, customers, services, settings). You’ll likely use a **“legacy tenant”** approach so the current client keeps the same URLs and experience while new clients get slug-based URLs (e.g. `yourapp.com/book/salon-slug`).
- **Hosted booking** (Vagar-style): “Link in bio” → your domain, their slug, same flow. Optionally later: embeddable widget on their site.
- **One sending domain** for email (your domain, Reply-To per tenant). One vendor for transactional + campaigns; you own templates and segments.
- **Payments:** Near term = their Square (per-tenant credentials). Later possibly you process (e.g. Connect).

So the product is: **simple, professional booking and admin for small service businesses**, with room to add more tenants, hosted booking pages, and eventually your own payment layer.

---

## What to nail for branding

- **Product name** (and any tagline).
- **Voice and tone** (support, marketing, in-app copy): who you are and how you sound.
- **Visual direction** (logo, color, typography, UI feel): so it doesn’t look “like DUST” forever; it looks like a neutral platform that any salon/studio could use.
- **Positioning** (one line or a short blurb): e.g. “Booking and admin for independent salons and studios” or “The booking page that lives in your link in bio.”

---

## Useful details for naming/positioning

- **Audience:** Independent salons, hair studios, possibly barbers, one-person or small-team service businesses. People who want a real booking system without the bloat of a big generic platform.
- **Differentiators (potential):** Clean booking flow, dual pricing (new vs regulars), calendar + availability that “just works,” optional campaigns and waitlist, pay-after-service + Square, and soon: multitenant so they get their own booking link and dashboard.
- **Tech / vibe:** Next.js, Supabase, modern but not “techy” in the UI. Feels calm and professional, not corporate.

Give this doc to the branding chat so they have the full picture before you iterate on names and concepts.
