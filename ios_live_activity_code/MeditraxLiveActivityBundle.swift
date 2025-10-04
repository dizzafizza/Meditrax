import WidgetKit
import SwiftUI

/// Widget Bundle for Meditrax Live Activities
/// Reference: https://developer.apple.com/documentation/widgetkit/widgetbundle
@main
@available(iOS 16.1, *)
struct MeditraxLiveActivityBundle: WidgetBundle {
    var body: some Widget {
        // Only include Live Activity, not static widgets
        if #available(iOS 16.2, *) {
            MeditraxLiveActivity()
        }
    }
}

