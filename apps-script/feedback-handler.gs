/**
 * FactionBuilder Feedback Handler — Google Apps Script
 *
 * ══ SETUP STEPS ════════════════════════════════════════════════════════════
 *
 *  1. Go to https://script.google.com and create a New Project.
 *     Name it something like "FactionBuilder Feedback".
 *
 *  2. Paste this entire file into the editor, replacing any existing code.
 *
 *  3. Fill in the two constants below (RECAPTCHA_SECRET_KEY and TO_EMAIL).
 *
 *  4. Click Deploy > New deployment.
 *     - Type:               Web app
 *     - Execute as:         Me (factionbuilder@gmail.com)
 *     - Who has access:     Anyone
 *     Click Deploy, then authorize the requested permissions.
 *
 *  5. Copy the Web App URL that appears after deployment.
 *
 *  6. Paste that URL into feedback.html as the value of APPS_SCRIPT_URL.
 *
 *  7. Also paste your reCAPTCHA v3 SITE KEY into feedback.html as
 *     the value of RECAPTCHA_SITE_KEY.
 *
 *  NOTE: Every time you change this script you must click
 *        Deploy > Manage deployments > ✏ Edit > New version > Deploy
 *        to make your changes live.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ── Configuration ──────────────────────────────────────────────────────────

/** Your reCAPTCHA v3 SECRET key (different from the site key in feedback.html) */
var RECAPTCHA_SECRET_KEY = 'YOUR_RECAPTCHA_SECRET_KEY';

/** Email address that receives feedback submissions */
var TO_EMAIL = 'factionbuilder@gmail.com';

/** Minimum reCAPTCHA v3 score to accept (0.0–1.0; 0.5 is a sensible default) */
var RECAPTCHA_MIN_SCORE = 0.5;

// ── Entry point ────────────────────────────────────────────────────────────

/**
 * Receives POST requests from the feedback form.
 * Google Apps Script calls this automatically for every POST to the web app URL.
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    // 1. Verify reCAPTCHA v3 token
    if (!verifyRecaptcha(data.recaptchaToken)) {
      // Silently succeed so bots don't know they were blocked
      return jsonResponse({ success: true });
    }

    // 2. Build and send the email
    sendFeedbackEmail(data);

    return jsonResponse({ success: true });

  } catch (err) {
    Logger.log('doPost error: ' + err.message);
    return jsonResponse({ success: false, error: err.message });
  }
}

// ── reCAPTCHA verification ─────────────────────────────────────────────────

function verifyRecaptcha(token) {
  if (!token) return false;

  var url = 'https://www.google.com/recaptcha/api/siteverify'
          + '?secret=' + encodeURIComponent(RECAPTCHA_SECRET_KEY)
          + '&response=' + encodeURIComponent(token);

  var response = UrlFetchApp.fetch(url, { method: 'post', muteHttpExceptions: true });
  var result   = JSON.parse(response.getContentText());

  Logger.log('reCAPTCHA result: ' + JSON.stringify(result));

  return result.success === true && result.score >= RECAPTCHA_MIN_SCORE;
}

// ── Email builder ──────────────────────────────────────────────────────────

function sendFeedbackEmail(data) {
  var subject = '[FactionBuilder] ' + (data.feedbackType || 'Feedback')
              + ' \u2014 ' + (data.factionBuilder || 'General');

  var body = [
    'New feedback submission from FactionBuilder.com',
    '',
    'Name:             ' + sanitize(data.name),
    'Email:            ' + sanitize(data.email),
    'Feedback Type:    ' + sanitize(data.feedbackType),
    'Faction Builder:  ' + sanitize(data.factionBuilder),
    '',
    'Message:',
    sanitize(data.message),
  ].join('\n');

  var options = {
    replyTo: sanitize(data.email),
  };

  // Attach image if provided
  if (data.imageBase64 && data.imageName && data.imageType) {
    var decoded = Utilities.base64Decode(data.imageBase64);
    var blob    = Utilities.newBlob(decoded, data.imageType, data.imageName);
    options.attachments = [blob];
  }

  GmailApp.sendEmail(TO_EMAIL, subject, body, options);

  Logger.log('Feedback email sent — subject: ' + subject);
}

// ── Utilities ──────────────────────────────────────────────────────────────

/** Strip any value that isn't a plain string to guard against injection. */
function sanitize(value) {
  return (typeof value === 'string') ? value.trim() : '';
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
