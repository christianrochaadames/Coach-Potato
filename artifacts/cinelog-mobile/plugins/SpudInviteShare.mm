#import <React/RCTBridgeModule.h>
#import <React/RCTUtils.h>
#import <UIKit/UIKit.h>
#import <LinkPresentation/LinkPresentation.h>

// Link metadata is provided locally so the native share header does not depend
// on network fetching or iOS's cached Safari preview of the invite URL.
@interface SpudInviteItem : NSObject <UIActivityItemSource>
@property(nonatomic, copy) NSString *message;
@property(nonatomic, strong) NSURL *url;
@end
@implementation SpudInviteItem
- (id)activityViewControllerPlaceholderItem:(UIActivityViewController *)controller { return self.message; }
- (id)activityViewController:(UIActivityViewController *)controller itemForActivityType:(UIActivityType)type { return self.message; }
- (NSString *)activityViewController:(UIActivityViewController *)controller subjectForActivityType:(UIActivityType)type { return @"Spud"; }
- (LPLinkMetadata *)activityViewControllerLinkMetadata:(UIActivityViewController *)controller {
  LPLinkMetadata *metadata = [LPLinkMetadata new];
  metadata.title = @"Spud";
  metadata.URL = self.url;
  // iOS renders the filename of originalURL as the share header's subtitle.
  metadata.originalURL = [NSURL fileURLWithPath:@"/Your TV Show & Movie tracker"];
  NSString *iconPath = [[NSBundle mainBundle] pathForResource:@"spud-share-icon" ofType:@"png"];
  UIImage *icon = iconPath ? [UIImage imageWithContentsOfFile:iconPath] : nil;
  if (icon) {
    metadata.iconProvider = [[NSItemProvider alloc] initWithObject:icon];
    metadata.imageProvider = [[NSItemProvider alloc] initWithObject:icon];
  }
  return metadata;
}
@end

@interface SpudInviteShare : NSObject <RCTBridgeModule>
@end
@implementation SpudInviteShare
RCT_EXPORT_MODULE();
+ (BOOL)requiresMainQueueSetup { return NO; }
RCT_EXPORT_METHOD(share:(NSString *)url message:(NSString *)message
                  resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_main_queue(), ^{
    UIViewController *presenter = RCTPresentedViewController();
    NSURL *inviteURL = [NSURL URLWithString:url];
    if (!presenter || !inviteURL) {
      reject(@"share_unavailable", @"Could not open the invite share sheet.", nil);
      return;
    }
    SpudInviteItem *item = [SpudInviteItem new];
    item.url = inviteURL;
    item.message = [message containsString:url] ? message : [NSString stringWithFormat:@"%@ %@", message, url];
    UIActivityViewController *sheet = [[UIActivityViewController alloc] initWithActivityItems:@[item] applicationActivities:nil];
    sheet.completionWithItemsHandler = ^(UIActivityType type, BOOL completed, NSArray *items, NSError *error) {
      if (error) reject(@"share_failed", error.localizedDescription, error);
      else resolve(@{@"completed": @(completed)});
    };
    if (sheet.popoverPresentationController) {
      sheet.popoverPresentationController.sourceView = presenter.view;
      sheet.popoverPresentationController.sourceRect = CGRectMake(CGRectGetMidX(presenter.view.bounds), CGRectGetMidY(presenter.view.bounds), 1, 1);
      sheet.popoverPresentationController.permittedArrowDirections = 0;
    }
    [presenter presentViewController:sheet animated:YES completion:nil];
  });
}
@end
