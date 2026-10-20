/**
 * Craft HTML notification host.
 * Deliver status updates without a script applet's modifier-key startup UI.
 */

#import <Cocoa/Cocoa.h>

/** Run only when launched with a notification identifier and status message. */
int main(int argc, const char *argv[]) {
  @autoreleasepool {
    // Opening a notification without arguments must not repeat any operation.
    if (argc != 3) {
      return 0;
    }

    NSApplication *application = [NSApplication sharedApplication];
    [application setActivationPolicy:NSApplicationActivationPolicyProhibited];

    NSUserNotification *notification = [[NSUserNotification alloc] init];
    notification.identifier = [NSString stringWithUTF8String:argv[1]];
    notification.title = @"Convert Craft Copy to HTML";
    notification.informativeText = [NSString stringWithUTF8String:argv[2]];
    [[NSUserNotificationCenter defaultUserNotificationCenter]
        deliverNotification:notification];

    // Give the system time to receive the update before this process exits.
    [[NSRunLoop currentRunLoop]
        runUntilDate:[NSDate dateWithTimeIntervalSinceNow:0.2]];
  }

  return 0;
}
