# Website contact forms: Google Sheets and Slack

Status: code prepared; receiver deployment and Slack webhook setup are still required.
The website submit buttons stay disabled until a real endpoint URL is configured.

## Response storage
Google Sheet: https://docs.google.com/spreadsheets/d/1W5pkNejGyI-ajSckzGUPJF1UW-WBlX_p4EhgQLd2lfk/edit
Tab: Submissions
Both Phil and DJ forms use this sheet. Recipient identifies the destination.
Notifications go to #all-dpschumar (C0C78CN9PC3) through its incoming webhook.
The sheet remains private; channel members need separate Sheet access to read messages.

## 1. Create the Slack incoming webhook
1. Open https://api.slack.com/apps and create an app named Website Contact Notifications in dpschumar.
2. Enable Incoming Webhooks, then choose Add New Webhook to Workspace.
3. Select #all-dpschumar and authorize the installation.
4. Keep the resulting webhook URL private. Do not add it to GitHub or website JavaScript.

## 2. Set up Google Apps Script
1. Open the response sheet and choose Extensions > Apps Script.
2. Replace Code.gs with apps-script/Code.gs from this change.
3. Open Project Settings > Script Properties.
4. Add SLACK_WEBHOOK_URL with the private URL from step 1.
5. Save, select installContactReceiver in the editor, and run it. Complete Google's authorization yourself.
   This verifies the sheet, sets America/Chicago as its timezone, and installs a five-minute Slack retry trigger.
6. Choose Deploy > New deployment > Web app:
   - Execute as: Me.
   - Who has access: Anyone (public website visitors).
7. Complete authorization and copy the web app URL ending in /exec.
   Never copy the /dev test URL.

This public endpoint can append contact rows and post to the chosen Slack webhook. It never serves response rows to visitors.
The script uses your Google identity and requires Sheets, external-request, and trigger permissions.
If your Google organization prevents public web apps, a different server host will be needed.

## 3. Enable the website
Set window.CONTACT_FORM_ENDPOINT in javascript/contact-config.js to the deployed /exec URL.
Leave all other credentials out of the repository.
Then merge the website change and let your hosting deployment complete.

## 4. Verify before launch
Use clearly labeled test entries with a real email you control.
Test both forms: each should open a new confirmation tab, append one sheet row, and notify #all-dpschumar.
Confirm Recipient is Phil or DJ as appropriate, and Slack status becomes Sent.
Confirm blank inputs and malformed email are rejected.
Repeat the same submission without editing it: the same submission ID should produce only one row.

## Operation
- Names: maximum 100 characters each; email: maximum 254; message: maximum 5,000.
- Each request is validated on the server. Visitor values are stored as literal text to prevent formula execution.
- A hidden spam field and a shared limit of 20 new submissions per minute provide basic spam protection.
  These are not a CAPTCHA or a strong per-person rate limit; add stronger protection if spam appears.
- Saved submissions return a confirmation even if Slack is down.
- Failed notifications are retried every five minutes, up to five total attempts.
- Failed rows remain in the sheet. To retry one after repairing the webhook, change Slack status to Pending
  and Slack attempts to 0, then run retrySlackNotifications.
- Slack delivery is at least once: an interruption after Slack accepts a message but before its row is marked Sent can cause a duplicate alert.
- Native form POST opens a separate confirmation tab and avoids cross-origin AJAX limitations.
  The original page never claims successful storage without that server confirmation.
- Changing server code requires a new deployment version in Apps Script.
- No live website submission or Slack notification has been tested yet.

References:
https://developers.google.com/apps-script/guides/web
https://api.slack.com/messaging/webhooks
