# Campaign Blasts via Resend Broadcasts

## Implemented

Campaign sends now use Resend **Broadcasts** (Marketing), not the transactional API. Create segments in Admin → Segments, then send campaigns to a segment.

**Background jobs**: Sends run via [Inngest](https://inngest.com). The UI returns immediately ("Campaign queued"); Inngest processes the send in the background. See setup below.

## Why Broadcasts?

- **Transactional API**: 100 emails/day limit. Used for booking confirmations, reminders, payment links.
- **Broadcasts** (Marketing): Separate limit (unlimited sends). Use for campaign blasts.

## Resend Broadcasts Flow

The app uses a **single reusable segment** (avoids the 3-segment plan limit):

1. **Get segment** – Uses `RESEND_CAMPAIGN_SEGMENT_ID` env, or finds/creates one named "DUST Campaign"
2. **Clear segment** – Removes previous recipients
3. **Add contacts** – Create contacts and add them to the segment
4. **Create & send broadcast** – Subject, HTML body, from address, targeting the segment

## API Flow (Resend Node SDK)

```typescript
// 1. Create segment
const { data: segment } = await resend.segments.create({
  name: `Campaign ${campaignId} - ${new Date().toISOString()}`
})

// 2. Add contacts to segment (per email)
for (const email of emailList) {
  await resend.contacts.create({ email })
  await resend.contacts.segments.add({ email, segmentId: segment.id })
}

// 3. Create broadcast (with send: true for immediate send)
const { data: broadcast } = await resend.broadcasts.create({
  segmentId: segment.id,
  from: 'DUST <updates@dusthairstudio.com>',
  subject: '...',
  html: '...',
  send: true  // or { send: true, scheduledAt: 'in 2 hours' }
})
```

## Variable Mapping

Current campaign variables → Resend Broadcast variables:

| Current   | Resend      |
|----------|-------------|
| `{email}` | `{{{EMAIL}}}` |
| `{customer_name}` | `{{{FIRST_NAME}}}` or custom property |
| `{current_date}` | Pre-rendered (Broadcasts use contact properties) |
| `{business_name}` | Pre-rendered |

Broadcasts support `{{{PROPERTY_NAME}}}` and `{{{PROPERTY_NAME|fallback}}}`. You may need to pre-render some variables into the HTML since Broadcasts don't support arbitrary runtime values the way transactional does.

## Implementation Options

### Option A: Modify send-campaign API

- Add env flag or setting: `USE_RESEND_BROADCASTS=true`
- When true, use Broadcasts flow instead of transactional loop
- Keep existing UI; only the backend changes

### Option B: New API route

- Add `POST /api/admin/send-campaign-broadcast`
- Campaign UI calls this for “Send via Broadcasts”
- Keeps transactional path for small/test sends

### Option C: Resend Dashboard

- Create segments and broadcasts manually in Resend
- Copy/paste recipient list from campaign UI
- No code changes; uses Resend’s built-in broadcast tools

## Troubleshooting "Failed to create broadcast segment"

The app now returns Resend’s error in the toast. Common causes:

1. **Broadcasts not enabled** – Resend Broadcasts may require a paid plan or add-on. Check [Resend Pricing](https://resend.com/pricing) and ensure Broadcasts/Audience is enabled.
2. **API key permissions** – The `RESEND_API_KEY` must have **Full access** (not only Sending). In [Resend API Keys](https://resend.com/api-keys), create a key with full access and use it for campaign sends.
3. **First-time setup** – Visit [Resend Audience](https://resend.com/audience) and ensure your account has Broadcasts/Audience set up. Some accounts need to enable it in the dashboard first.

## Optional: RESEND_CAMPAIGN_SEGMENT_ID

Set this env var to the ID of your campaign segment if you created it manually in Resend. Otherwise the app will find or create a segment named "DUST Campaign".

## Inngest setup

- **Local dev**: Run `npx inngest-cli@latest dev` alongside `npm run dev`. Inngest Dev Server UI: http://localhost:8288
- **Production**: Connect your app at [Inngest Cloud](https://app.inngest.com). Add `INNGEST_SIGNING_KEY` and `INNGEST_EVENT_KEY` to Vercel env vars. No separate infrastructure needed.

## Considerations

1. **Contact creation** – Resend has 1,000 free Marketing contacts. Contacts persist across sends.
2. **Batch size** – Creating hundreds of contacts + adding to segment is sequential (rate limited). Runs in background via Inngest.
3. **Unsubscribe** – Broadcasts include `{{{RESEND_UNSUBSCRIBE_URL}}}`. Add this to the HTML template for compliance.
4. **Duplicate contacts** – Creating a contact that already exists may upsert; verify Resend’s behavior.
5. **Segment lifecycle** – Segments can be reused or created per campaign. Per-campaign segments keep sends isolated.

## Recommended Path

1. **Short term**: Use Resend Dashboard for the next campaign (Option C) – paste the failed-recipient list and send as a Broadcast.
2. **Medium term**: Implement Option A or B so campaign sends in the app use Broadcasts by default and avoid the 100/day transactional limit.
