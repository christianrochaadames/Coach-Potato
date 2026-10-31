#import <React/RCTBridgeModule.h>
#import <React/RCTUtils.h>
#import <UIKit/UIKit.h>
#import <LinkPresentation/LinkPresentation.h>

// Link metadata is provided locally so the native share header does not depend
// on network fetching or iOS's cached Safari preview of the invite URL.
@interface SpudInviteItem : NSObject <UIActivityItemSource>
@property(nonatomic, copy) NSString *message;
@property(nonatomic, strong) NSURL *url;
@property(nonatomic, copy) NSString *previewTitle;
@property(nonatomic, copy) NSString *previewSubtitle;
@property(nonatomic, strong) UIImage *previewImage;
@end
@implementation SpudInviteItem
- (id)activityViewControllerPlaceholderItem:(UIActivityViewController *)controller { return self.message; }
- (id)activityViewController:(UIActivityViewController *)controller itemForActivityType:(UIActivityType)type { return self.message; }
- (NSString *)activityViewController:(UIActivityViewController *)controller subjectForActivityType:(UIActivityType)type { return @"Spud"; }
- (LPLinkMetadata *)activityViewControllerLinkMetadata:(UIActivityViewController *)controller {
  LPLinkMetadata *metadata = [LPLinkMetadata new];
  metadata.title = self.previewTitle ?: @"Spud";
  metadata.URL = self.url;
  // iOS renders the filename of originalURL as the share header's subtitle.
  metadata.originalURL = [NSURL fileURLWithPath:[@"/" stringByAppendingString:self.previewSubtitle ?: @"Your TV Show & Movie tracker"]];
  NSString *iconPath = [[NSBundle mainBundle] pathForResource:@"spud-share-icon" ofType:@"png"];
  UIImage *icon = self.previewImage ?: (iconPath ? [UIImage imageWithContentsOfFile:iconPath] : nil);
  if (icon) {
    metadata.iconProvider = [[NSItemProvider alloc] initWithObject:icon];
    metadata.imageProvider = [[NSItemProvider alloc] initWithObject:icon];
  }
  return metadata;
}
@end

@interface SpudInviteShare : NSObject <RCTBridgeModule>
- (void)presentURL:(NSString *)url message:(NSString *)message title:(NSString *)title
         subtitle:(NSString *)subtitle image:(UIImage *)image
          resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject;
@end
@implementation SpudInviteShare
RCT_EXPORT_MODULE();
+ (BOOL)requiresMainQueueSetup { return NO; }
RCT_EXPORT_METHOD(share:(NSString *)url message:(NSString *)message
                  resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  [self presentURL:url message:message title:@"Spud" subtitle:@"Your TV Show & Movie tracker"
             image:nil resolve:resolve reject:reject];
}

// Title shares use local link metadata as well: the real URL is still sent to
// recipients, but the native header shows Spud branding instead of the domain.
RCT_EXPORT_METHOD(shareTitle:(NSString *)url message:(NSString *)message subtitle:(NSString *)subtitle
                  posterUrl:(NSString *)posterUrl
                  resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  NSURL *posterURL = posterUrl.length ? [NSURL URLWithString:posterUrl] : nil;
  if (!posterURL || ![@[@"https", @"http"] containsObject:posterURL.scheme.lowercaseString]) {
    [self presentURL:url message:message title:message subtitle:subtitle image:nil resolve:resolve reject:reject];
    return;
  }
  NSURLRequest *request = [NSURLRequest requestWithURL:posterURL
      cachePolicy:NSURLRequestReturnCacheDataElseLoad timeoutInterval:4.0];
  [[[NSURLSession sharedSession] dataTaskWithRequest:request
      completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
        UIImage *poster = data.length && !error ? [UIImage imageWithData:data] : nil;
        // A missing poster should not prevent sharing a valid title link.
        [self presentURL:url message:message title:message subtitle:subtitle
                  image:poster resolve:resolve reject:reject];
      }] resume];
}

- (void)presentURL:(NSString *)url message:(NSString *)message title:(NSString *)title
         subtitle:(NSString *)subtitle image:(UIImage *)image
          resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  dispatch_async(dispatch_get_main_queue(), ^{
    UIViewController *presenter = RCTPresentedViewController();
    NSURL *inviteURL = [NSURL URLWithString:url];
    if (!presenter || !inviteURL) {
      reject(@"share_unavailable", @"Could not open the share sheet.", nil);
      return;
    }
    SpudInviteItem *item = [SpudInviteItem new];
    item.url = inviteURL;
    item.previewTitle = title;
    item.previewSubtitle = subtitle;
    item.previewImage = image;
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
