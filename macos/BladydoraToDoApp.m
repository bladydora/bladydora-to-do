#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>

@interface AppDelegate : NSObject <NSApplicationDelegate, WKNavigationDelegate>
@property(nonatomic, strong) NSWindow *window;
@property(nonatomic, strong) WKWebView *webView;
@property(nonatomic, strong) NSTask *serverTask;
@property(nonatomic, assign) NSInteger attempts;
@end

@implementation AppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
    [self startServer];
    [self createWindow];
    [self loadAppWhenReady];
}

- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)sender {
    return YES;
}

- (void)applicationWillTerminate:(NSNotification *)notification {
    [self.serverTask terminate];
}

- (void)createWindow {
    WKWebViewConfiguration *configuration = [[WKWebViewConfiguration alloc] init];
    self.webView = [[WKWebView alloc] initWithFrame:NSZeroRect configuration:configuration];
    self.webView.navigationDelegate = self;

    self.window = [[NSWindow alloc]
        initWithContentRect:NSMakeRect(0, 0, 1280, 820)
                  styleMask:NSWindowStyleMaskTitled |
                            NSWindowStyleMaskClosable |
                            NSWindowStyleMaskMiniaturizable |
                            NSWindowStyleMaskResizable |
                            NSWindowStyleMaskFullSizeContentView
                    backing:NSBackingStoreBuffered
                      defer:NO];
    self.window.title = @"Bladydora To Do";
    self.window.titlebarAppearsTransparent = YES;
    self.window.titleVisibility = NSWindowTitleHidden;
    self.window.minSize = NSMakeSize(1040, 680);
    self.window.contentView = self.webView;
    [self.window center];
    [self.window makeKeyAndOrderFront:nil];
}

- (void)startServer {
    NSString *resourcePath = [[NSBundle mainBundle] resourcePath];
    NSString *serverPath = [resourcePath stringByAppendingPathComponent:@"server.mjs"];
    NSString *publicPath = [resourcePath stringByAppendingPathComponent:@"public"];
    NSString *supportPath = [[self applicationSupportPath] stringByStandardizingPath];
    NSString *dataPath = [supportPath stringByAppendingPathComponent:@"store.json"];

    NSError *directoryError = nil;
    [[NSFileManager defaultManager] createDirectoryAtPath:supportPath
                              withIntermediateDirectories:YES
                                               attributes:nil
                                                    error:&directoryError];
    if (directoryError) {
        [self showFatalError:[NSString stringWithFormat:@"无法创建数据目录：%@", directoryError.localizedDescription]];
        return;
    }

    NSString *nodePath = [self nodePath];
    if (!nodePath) {
        [self showFatalError:@"无法找到 Node.js。请确认 /opt/homebrew/bin/node 或 /usr/local/bin/node 可用。"];
        return;
    }

    self.serverTask = [[NSTask alloc] init];
    self.serverTask.currentDirectoryPath = resourcePath;
    self.serverTask.launchPath = nodePath;
    self.serverTask.arguments = [nodePath.lastPathComponent isEqualToString:@"env"]
        ? @[@"node", serverPath]
        : @[serverPath];
    self.serverTask.environment = @{
        @"PATH": @"/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin",
        @"PORT": @"4175",
        @"HOST": @"127.0.0.1",
        @"PUBLIC_DIR": publicPath,
        @"DATA_PATH": dataPath
    };

    NSString *logPath = [supportPath stringByAppendingPathComponent:@"server.log"];
    if (![[NSFileManager defaultManager] fileExistsAtPath:logPath]) {
        [[NSFileManager defaultManager] createFileAtPath:logPath contents:nil attributes:nil];
    }
    NSFileHandle *logHandle = [NSFileHandle fileHandleForWritingAtPath:logPath];
    [logHandle seekToEndOfFile];
    self.serverTask.standardOutput = logHandle;
    self.serverTask.standardError = logHandle;

    @try {
        [self.serverTask launch];
    } @catch (NSException *exception) {
        [self showFatalError:[NSString stringWithFormat:@"无法启动本地服务：%@", exception.reason]];
    }
}

- (NSString *)nodePath {
    NSArray<NSString *> *candidates = @[
        @"/opt/homebrew/bin/node",
        @"/usr/local/bin/node",
        @"/usr/bin/node",
        @"/usr/bin/env"
    ];
    for (NSString *path in candidates) {
        if ([[NSFileManager defaultManager] isExecutableFileAtPath:path]) {
            return path;
        }
    }
    return nil;
}

- (NSString *)applicationSupportPath {
    NSArray<NSString *> *paths = NSSearchPathForDirectoriesInDomains(NSApplicationSupportDirectory, NSUserDomainMask, YES);
    return [[paths firstObject] stringByAppendingPathComponent:@"Bladydora To Do"];
}

- (void)loadAppWhenReady {
    NSURL *url = [NSURL URLWithString:@"http://127.0.0.1:4175"];
    NSURLSessionDataTask *task = [[NSURLSession sharedSession]
        dataTaskWithURL:url
      completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
          NSHTTPURLResponse *http = (NSHTTPURLResponse *)response;
          if ([http statusCode] == 200) {
              dispatch_async(dispatch_get_main_queue(), ^{
                  [self.webView loadRequest:[NSURLRequest requestWithURL:url]];
              });
              return;
          }
          if (self.attempts < 30) {
              self.attempts += 1;
              dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.2 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
                  [self loadAppWhenReady];
              });
          } else {
              dispatch_async(dispatch_get_main_queue(), ^{
                  [self showFatalError:@"本地服务启动超时。"];
              });
          }
      }];
    [task resume];
}

- (void)showFatalError:(NSString *)message {
    NSAlert *alert = [[NSAlert alloc] init];
    alert.messageText = @"Bladydora To Do 无法启动";
    alert.informativeText = message;
    alert.alertStyle = NSAlertStyleCritical;
    [alert runModal];
}

@end

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        NSApplication *application = [NSApplication sharedApplication];
        AppDelegate *delegate = [[AppDelegate alloc] init];
        application.delegate = delegate;
        [application setActivationPolicy:NSApplicationActivationPolicyRegular];
        [application activateIgnoringOtherApps:YES];
        [application run];
    }
    return 0;
}
