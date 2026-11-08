# D.P. SchuMar contacts: Google Sheets → private Discord alerts

## Status

**Prepared in GitHub; not yet deployed.** The existing public contact forms and Google Sheet remain in place. Updating repository code does not update the live Google Apps Script project: the owner must configure a Discord channel webhook, copy the new `apps-script/Code.gs` into the Apps Script editor, and redeploy.

## What changes

- Phil's and DJ's existing forms still POST to the same public Apps Script `/exec` endpoint.
- The existing private Google Sheet remains the authoritative message archive.
- Discord receives a notice with the recipient (Phil or DJ) and a link to the exact private Sheet row.
- Visitor names, emails and message text are **not sent to Discord**.
- A missing or broken Discord webhook **does not prevent storing submitted messages**.
- Existing rows (including previously delivered Slack messages) are not deleted or re-sent.
- Failed notifications remain in the Sheet and are retried every five minutes, up to five attempts.

**Existing response sheet:** https://docs.google.com/spreadsheets/d/1W5pkNejGyI-ajSckzGUPJF1UW-WBlX_p4EhgQLd2lfk/edit

## One-time owner setup

1. In your Discord server, create or select a **private text channel** such as `#website-contact`. Make sure only Phil and DJ (and anyone explicitly trusted) can see it.
2. Open that channel's **Edit Channel → Integrations → Webhooks → New Webhook**. Create a webhook for this channel and copy its URL. Treat the URL as a password. Do not paste it into GitHub, the website, or this chat.
3. Sign in to the Google account that owns the response Sheet. In the Sheet's **Share** dialog, add DJ's Google account as **Viewer** (or Editor only if appropriate). Don't select **Anyone with the link**; a private Discord channel does not itself give DJ Google Sheet permissions.
4. From the Sheet, open **Extensions → Apps Script**. Make a private backup of the original `Code.gs`. Replace its code with the version at `apps-script/Code.gs` from this feature branch.
5. In **Apps Script → Project Settings → Script Properties**, add property `DISCORD_WEBHOOK_URL` with the Discord URL you copied. Never publish its value.
6. In the editor, select `installContactReceiver` and click **Run** once. Approve Google permissions. This validates the webhook URL, preserves all data, renames only the Slack status/attempts **column headings** to Discord, removes the old Slack timer, and installs the new five-minute Discord retry timer.
7. Go to **Deploy → Manage deployments**, select the existing production web-app deployment, click **Edit**, select **New version**, and **Deploy**. Keep **Execute as: Me** and **Who has access: Anyone**. Updating the existing deployment preserves the `/exec` URL and avoids changes to the website's `javascript/contact-config.js`. Do not use a `/dev` URL on the public site.
8. Submit two clearly labelled tests from the actual live website: one addressed to **Phil**, one to **DJ**. Confirm that each form opens a successful confirmation tab, creates exactly one new row, changes the row's Discord status to `Sent`, and produces one Discord alert. Open the Sheet link from both Google accounts.
9. After both work, you may remove the unused `SLACK_WEBHOOK_URL` Script Property. The script no longer uses Slack.

## Troubleshooting

- **Saved but no Discord notification:** Check the `DISCORD_WEBHOOK_URL` property, the channel's webhook, the row's Discord status and attempts, and Apps Script execution history. The saved message is not lost.
- **Only Phil can view the Sheet:** Share the Sheet directly with DJ's correct Google email address. Discord permissions are separate.
- **Pending:** The scheduled retry job tries again. **Failed:** After the webhook is repaired, change status to `Pending`, attempts to `0`, then run `retryDiscordNotifications` or await the timer.
- **429 rate limit:** The script stops the batch, retains `Pending`, and retries later.
- **Occasional duplicate Discord alerts:** Notifications are at-least-once: if Discord accepts a notice but the script stops before writing `Sent`, it may send a duplicate.
- **Message not received:** Check the Sheet headers, form fields, deployment version, and Apps Script execution history. Do not share visitor messages or private webhook URLs when debugging.
- The public form already has a hidden spam field and a shared minute-level burst limit, but not robust CAPTCHA or per-visitor throttling.

## Files

- `apps-script/Code.gs`: replacement backend.
- `javascript/contact-form.js`: unchanged.
- `javascript/contact-config.js`: unchanged (the production `/exec` URL stays the same).

Official references:
- https://discord.com/developers/docs/resources/webhook
- https://developers.google.com/apps-script/concepts/deployments
