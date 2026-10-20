/**
 * Craft HTML notification app.
 * @file Deliver replacement notifications from a registered background app.
 */

/* exported run */

ObjC.import("AppKit");

/**
 * Deliver progress or replace its terminal state under the same identity.
 * @param {string} identity Unique identifier shared by a conversion's updates.
 * @param {string} message Progress, success, or error text.
 * @param {object} center Native notification center, injectable for tests.
 */
function showStatus(identity, message, center) {
  const notification = $.NSUserNotification.alloc.init;

  notification.identifier = identity;
  notification.title = "Convert Craft Copy to HTML";
  notification.informativeText = message;
  center.deliverNotification(notification);
}

/**
 * Run as a background script app; opening a notification cannot repeat a copy.
 */
function run() {
  const args = ObjC.deepUnwrap($.NSProcessInfo.processInfo.arguments);

  if (args.length < 3) return;

  showStatus(args[1], args[2], $.NSUserNotificationCenter.defaultUserNotificationCenter);
  // Allow the system to receive the notification before this short-lived app exits.
  delay(0.2);
}
