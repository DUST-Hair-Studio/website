# Campaign Blasts via Resend Broadcasts

## Implemented

Campaign sends now use Resend **Broadcasts** (Marketing), not the transactional API. Create segments in Admin → Segments, then send campaigns to a segment.

## Why Broadcasts?

- **Transactional API**: 100 emails/day limit. Used for booking confirmations, reminders, payment links.
- **Broadcasts** (Marketing): Separate limit (unlimited sends). Use for campaign blasts.

## Resend Broadcasts Flow

1. **Create Segment** – A segment holds the recipient list for this send
2. **Add Contacts** – Create contacts and add them to the segment
3. **Create Broadcast** – Subject, HTML body, from address, targeting the segment
4. **Send Broadcast** – Trigger send (immediate or scheduled)

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

## Considerations

1. **Contact creation** – Resend has 1,000 free Marketing contacts. Contacts persist across sends.
2. **Batch size** – Creating hundreds of contacts + adding to segment is sequential; expect 1–2 seconds per contact. Consider background job for large lists.
3. **Unsubscribe** – Broadcasts include `{{{RESEND_UNSUBSCRIBE_URL}}}`. Add this to the HTML template for compliance.
4. **Duplicate contacts** – Creating a contact that already exists may upsert; verify Resend’s behavior.
5. **Segment lifecycle** – Segments can be reused or created per campaign. Per-campaign segments keep sends isolated.

## Recommended Path

1. **Short term**: Use Resend Dashboard for the next campaign (Option C) – paste the failed-recipient list and send as a Broadcast.
2. **Medium term**: Implement Option A or B so campaign sends in the app use Broadcasts by default and avoid the 100/day transactional limit.
