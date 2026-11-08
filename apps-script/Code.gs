/**
 * D.P. SchuMar website contact receiver.
 * Save visitor messages in the private Google Sheet, then send a minimal
 * notification to a private Discord channel.
 * Store DISCORD_WEBHOOK_URL in Apps Script Script Properties, never in GitHub.
 */
const CONTACT_SHEET_ID = '1W5pkNejGyI-ajSckzGUPJF1UW-WBlX_p4EhgQLd2lfk';
const CONTACT_HEADERS = ['Received at', 'Recipient', 'First name', 'Last name', 'Email', 'Message', 'Submission ID', 'Discord status', 'Discord attempts'];
const LEGACY_CONTACT_HEADERS = ['Received at', 'Recipient', 'First name', 'Last name', 'Email', 'Message', 'Submission ID', 'Slack status', 'Slack attempts'];

function contactSheet_() {
  const sheet = SpreadsheetApp.openById(CONTACT_SHEET_ID).getSheetByName('Submissions');
  if (!sheet) throw new Error('Submissions tab was not found.');
  const headers = sheet.getRange(1, 1, 1, 9).getValues()[0];
  const current = JSON.stringify(headers) === JSON.stringify(CONTACT_HEADERS);
  const legacy = JSON.stringify(headers) === JSON.stringify(LEGACY_CONTACT_HEADERS);
  if (!current && !legacy) throw new Error('Response sheet headers do not match.');
  return sheet;
}

function discordWebhook_() {
  const url = String(PropertiesService.getScriptProperties().getProperty('DISCORD_WEBHOOK_URL') || '').trim();
  if (!/^https:\/\/(?:discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[A-Za-z0-9._-]+$/.test(url)) {
    throw new Error('Configure DISCORD_WEBHOOK_URL in Script Properties.');
  }
  return url;
}

function installContactReceiver() {
  // Installation validates Discord configuration, but saving a contact does not.
  discordWebhook_();
  const sheet = contactSheet_();
  const headers = sheet.getRange(1, 1, 1, 9).getValues()[0];
  if (JSON.stringify(headers) === JSON.stringify(LEGACY_CONTACT_HEADERS)) {
    // Preserve all previous messages and statuses while changing only headers.
    sheet.getRange(1, 8, 1, 2).setValues([['Discord status', 'Discord attempts']]);
  }
  sheet.getParent().setSpreadsheetTimeZone('America/Chicago');
  sheet.setFrozenRows(1);
  for (const trigger of ScriptApp.getProjectTriggers()) {
    if (trigger.getHandlerFunction() === 'retrySlackNotifications') {
      ScriptApp.deleteTrigger(trigger);
    }
  }
  if (!ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'retryDiscordNotifications')) {
    ScriptApp.newTrigger('retryDiscordNotifications').timeBased().everyMinutes(5).create();
  }
}

function field_(p, name, maxLength) {
  const value = String(p[name] || '').trim();
  if (!value || value.length > maxLength) throw new Error('Invalid field.');
  return value;
}

function literal_(value) {
  // Prevent visitor text from becoming a spreadsheet formula.
  return /^[=+\-@]/.test(value) ? "'" + value : value;
}

function confirmation_(saved) {
  const title = saved ? 'Message received' : 'Message not received';
  const message = saved
    ? 'Thank you. Your message has been saved. You can close this tab and return to the website.'
    : 'Your message could not be saved. Please return to the website and try again later.';
  return HtmlService.createHtmlOutput('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + title + '</title></head><body style="font-family:Arial,sans-serif;max-width:40rem;margin:4rem auto;padding:1rem"><h1>' + title + '</h1><p>' + message + '</p></body></html>');
}

function doGet() {
  return HtmlService.createHtmlOutput('This endpoint accepts contact form submissions only.');
}

function doPost(e) {
  let saved = false;
  const lock = LockService.getScriptLock();
  try {
    const p = e && e.parameter || {};
    if (String(p.website || '').trim()) throw new Error('Rejected.');
    const first = field_(p, 'first-name', 100);
    const last = field_(p, 'last-name', 100);
    const email = field_(p, 'email', 254);
    const message = field_(p, 'message', 5000);
    const recipient = field_(p, 'recipient', 10);
    const id = field_(p, 'submission-id', 64);
    if (!['Phil', 'DJ'].includes(recipient) || !/^[a-zA-Z0-9-]{16,64}$/.test(id)
        || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid submission.');
    lock.waitLock(10000);
    const sheet = contactSheet_();
    const lastRow = sheet.getLastRow();
    const existing = lastRow > 1
      ? sheet.getRange(2, 7, lastRow - 1, 1).createTextFinder(id).matchEntireCell(true).findNext()
      : null;
    if (!existing) {
      // A basic burst limit plus honeypot. Add CAPTCHA if stronger spam protection is needed.
      const cache = CacheService.getScriptCache();
      const key = 'contact-minute-' + Math.floor(Date.now() / 60000);
      const count = Number(cache.get(key) || 0);
      if (count >= 20) throw new Error('Busy.');
      cache.put(key, String(count + 1), 120);
      sheet.appendRow([new Date(), recipient, literal_(first), literal_(last), literal_(email),
        literal_(message), id, 'Pending', 0]);
      SpreadsheetApp.flush();
    }
    saved = true;
  } catch (_) {
    // Do not put visitor data or credentials in error pages or logs.
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
  if (saved) {
    try { retryDiscordNotifications(); } catch (_) {}
  }
  return confirmation_(saved);
}

function retryDiscordNotifications() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const url = discordWebhook_();
    const sheet = contactSheet_();
    const count = sheet.getLastRow() - 1;
    if (count < 1) return;
    const rows = sheet.getRange(2, 1, count, 9).getValues();
    let processed = 0;
    for (let i = 0; i < rows.length && processed < 10; i++) {
      const row = rows[i];
      if (row[7] !== 'Pending') continue;
      processed++;
      const attempts = Number(row[8] || 0) + 1;
      const recipient = row[1] === 'DJ' ? 'DJ' : row[1] === 'Phil' ? 'Phil' : 'Unknown';
      // No visitor names, email addresses, or message bodies are posted to Discord.
      const sheetUrl = 'https://docs.google.com/spreadsheets/d/' + CONTACT_SHEET_ID
        + '/edit#gid=' + sheet.getSheetId() + '&range=A' + (i + 2) + ':I' + (i + 2);
      let delivered = false;
      let rateLimited = false;
      try {
        const response = UrlFetchApp.fetch(url, {
          method: 'post',
          contentType: 'application/json',
          muteHttpExceptions: true,
          payload: JSON.stringify({
            username: 'D.P. SchuMar Contact Alerts',
            content: 'New D.P. SchuMar website contact for **' + recipient
              + '**. Read it in the private Google Sheet: <' + sheetUrl + '>',
            allowed_mentions: {parse: []}
          })
        });
        const status = response.getResponseCode();
        delivered = status === 204 || status === 200;
        rateLimited = status === 429;
      } catch (_) {
        // An offline Discord webhook must not lose stored visitor messages.
      }
      if (rateLimited) break; // Leave Pending without consuming an attempt.
      sheet.getRange(i + 2, 8, 1, 2).setValues([[
        delivered ? 'Sent' : attempts >= 5 ? 'Failed' : 'Pending', attempts
      ]]);
    }
  } finally {
    lock.releaseLock();
  }
}
