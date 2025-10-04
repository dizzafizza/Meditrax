# iOS Live Activities Setup Guide

## Overview
This guide explains how to add Live Activities support to Meditrax iOS app. Live Activities show real-time medication effect tracking on the lock screen and Dynamic Island (iPhone 14 Pro+).

---

## Prerequisites
- macOS with Xcode 14+
- iOS 16.1+ target device
- Meditrax iOS project already created via Capacitor

---

## Step 1: Open iOS Project in Xcode

```bash
npm run cap:ios
```

This opens the iOS project in Xcode.

---

## Step 2: Create Widget Extension

1. In Xcode, go to **File → New → Target...**
2. Search for **Widget Extension**
3. Click **Next**
4. Configure the widget:
   - **Product Name**: `MeditraxLiveActivity`
   - **Team**: Select your development team
   - **Include Configuration Intent**: ❌ Uncheck
   - **Include Live Activity**: ✅ **CHECK THIS BOX**
5. Click **Finish**
6. When prompted "Activate 'MeditraxLiveActivity' scheme?", click **Activate**

Xcode will create:
```
ios/App/MeditraxLiveActivity/
  ├── MeditraxLiveActivity.swift
  ├── MeditraxLiveActivityLiveActivity.swift
  ├── MeditraxLiveActivityBundle.swift
  └── Assets.xcassets/
```

---

## Step 3: Define Live Activity Attributes

Replace the contents of `MeditraxLiveActivityLiveActivity.swift` with:

```swift
import ActivityKit
import WidgetKit
import SwiftUI

struct MeditraxLiveActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        // Medication information
        var medicationName: String
        var medicationDosage: String
        
        // Effect tracking state
        var currentPhase: String        // "pre_onset", "kicking_in", "peaking", "wearing_off", "worn_off"
        var minutesElapsed: Int
        var progress: Double            // 0-100
        var phaseDescription: String    // "Peak in 45 min"
        
        // Timeline milestones
        var onsetMinutes: Int
        var peakMinutes: Int
        var wearOffMinutes: Int
        var durationMinutes: Int
        
        // Last update
        var lastUpdated: Date
    }
    
    // Static attributes (don't change during activity)
    var medicationId: String
    var startTime: Date
}

struct MeditraxLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: MeditraxLiveActivityAttributes.self) { context in
            // Lock screen UI
            LockScreenLiveActivityView(context: context)
        } dynamicIsland: { context in
            // Dynamic Island UI
            DynamicIsland {
                // Expanded view
                DynamicIslandExpandedRegion(.leading) {
                    Label(context.state.medicationName, systemImage: "pills.fill")
                        .font(.caption)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.state.phaseDescription)
                        .font(.caption)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack {
                        ProgressView(value: context.state.progress, total: 100)
                            .tint(getPhaseColor(context.state.currentPhase))
                        HStack {
                            Text(getPhaseEmoji(context.state.currentPhase))
                            Text(statusText(for: context.state.currentPhase))
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Spacer()
                            Text("\(context.state.minutesElapsed)m")
                                .font(.caption.monospacedDigit())
                        }
                    }
                }
            } compactLeading: {
                Text("💊")
            } compactTrailing: {
                Text("\(context.state.minutesElapsed)m")
                    .font(.caption.monospacedDigit())
            } minimal: {
                Text("💊")
            }
        }
    }
    
    func getPhaseColor(_ phase: String) -> Color {
        switch phase {
        case "pre_onset": return .blue
        case "kicking_in": return .cyan
        case "peaking": return .green
        case "wearing_off": return .orange
        case "worn_off": return .gray
        default: return .blue
        }
    }
    
    func getPhaseEmoji(_ phase: String) -> String {
        switch phase {
        case "pre_onset": return "⏱️"
        case "kicking_in": return "🔄"
        case "peaking": return "🎯"
        case "wearing_off": return "📉"
        case "worn_off": return "✅"
        default: return "💊"
        }
    }
    
    func statusText(for phase: String) -> String {
        switch phase {
        case "pre_onset": return "Starting"
        case "kicking_in": return "Kicking In"
        case "peaking": return "Peaking"
        case "wearing_off": return "Wearing Off"
        case "worn_off": return "Complete"
        default: return "Tracking"
        }
    }
}

struct LockScreenLiveActivityView: View {
    let context: ActivityViewContext<MeditraxLiveActivityAttributes>
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "pills.fill")
                    .foregroundColor(.blue)
                Text(context.state.medicationName)
                    .font(.headline)
                Spacer()
                Text(context.state.medicationDosage)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            
            ProgressView(value: context.state.progress, total: 100)
                .tint(getPhaseColor(for: context.state.currentPhase))
            
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(getPhaseEmoji(for: context.state.currentPhase) + " " + statusText(for: context.state.currentPhase))
                        .font(.caption)
                        .fontWeight(.semibold)
                    Text(context.state.phaseDescription)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
                Spacer()
                Text("\(context.state.minutesElapsed) min")
                    .font(.title3.monospacedDigit())
                    .foregroundColor(.blue)
            }
        }
        .padding()
    }
    
    func getPhaseColor(for phase: String) -> Color {
        switch phase {
        case "pre_onset": return .blue
        case "kicking_in": return .cyan
        case "peaking": return .green
        case "wearing_off": return .orange
        case "worn_off": return .gray
        default: return .blue
        }
    }
    
    func getPhaseEmoji(for phase: String) -> String {
        switch phase {
        case "pre_onset": return "⏱️"
        case "kicking_in": return "🔄"
        case "peaking": return "🎯"
        case "wearing_off": return "📉"
        case "worn_off": return "✅"
        default: return "💊"
        }
    }
    
    func statusText(for phase: String) -> String {
        switch phase {
        case "pre_onset": return "Starting"
        case "kicking_in": return "Kicking In"
        case "peaking": return "Peaking"
        case "wearing_off": return "Wearing Off"
        case "worn_off": return "Complete"
        default: return "Tracking"
        }
    }
}
```

---

## Step 4: Update Info.plist

Add Live Activities support to `ios/App/App/Info.plist`:

```xml
<key>NSSupportsLiveActivities</key>
<true/>
<key>NSSupportsLiveActivitiesFrequentUpdates</key>
<true/>
```

Also ensure Background Modes are configured:

```xml
<key>UIBackgroundModes</key>
<array>
    <string>fetch</string>
    <string>processing</string>
    <string>remote-notification</string>
</array>
```

---

## Step 5: Create Native Capacitor Plugin

Create a new file: `ios/App/App/LiveActivityPlugin.swift`

```swift
import Foundation
import Capacitor
import ActivityKit

@objc(LiveActivityPlugin)
public class LiveActivityPlugin: CAPPlugin {
    private var activity: Activity<MeditraxLiveActivityAttributes>?
    
    @objc func start(_ call: CAPPluginCall) {
        guard #available(iOS 16.1, *) else {
            call.reject("Live Activities require iOS 16.1+")
            return
        }
        
        let sessionId = call.getString("sessionId") ?? ""
        let state = call.getObject("state") ?? [:]
        
        let attributes = MeditraxLiveActivityAttributes(
            medicationId: state["medicationId"] as? String ?? "",
            startTime: Date()
        )
        
        let contentState = MeditraxLiveActivityAttributes.ContentState(
            medicationName: state["medicationName"] as? String ?? "",
            medicationDosage: state["medicationDosage"] as? String ?? "",
            currentPhase: state["currentPhase"] as? String ?? "pre_onset",
            minutesElapsed: state["minutesElapsed"] as? Int ?? 0,
            progress: state["progress"] as? Double ?? 0.0,
            phaseDescription: state["phaseDescription"] as? String ?? "",
            onsetMinutes: state["onsetMinutes"] as? Int ?? 30,
            peakMinutes: state["peakMinutes"] as? Int ?? 90,
            wearOffMinutes: state["wearOffMinutes"] as? Int ?? 180,
            durationMinutes: state["durationMinutes"] as? Int ?? 240,
            lastUpdated: Date()
        )
        
        do {
            activity = try Activity<MeditraxLiveActivityAttributes>.request(
                attributes: attributes,
                contentState: contentState,
                pushType: nil
            )
            call.resolve(["activityId": activity?.id ?? ""])
        } catch {
            call.reject("Failed to start Live Activity: \(error.localizedDescription)")
        }
    }
    
    @objc func update(_ call: CAPPluginCall) {
        guard #available(iOS 16.1, *) else {
            call.reject("Live Activities require iOS 16.1+")
            return
        }
        
        guard let activity = activity else {
            call.reject("No active Live Activity")
            return
        }
        
        let state = call.getObject("state") ?? [:]
        
        let contentState = MeditraxLiveActivityAttributes.ContentState(
            medicationName: state["medicationName"] as? String ?? "",
            medicationDosage: state["medicationDosage"] as? String ?? "",
            currentPhase: state["currentPhase"] as? String ?? "pre_onset",
            minutesElapsed: state["minutesElapsed"] as? Int ?? 0,
            progress: state["progress"] as? Double ?? 0.0,
            phaseDescription: state["phaseDescription"] as? String ?? "",
            onsetMinutes: state["onsetMinutes"] as? Int ?? 30,
            peakMinutes: state["peakMinutes"] as? Int ?? 90,
            wearOffMinutes: state["wearOffMinutes"] as? Int ?? 180,
            durationMinutes: state["durationMinutes"] as? Int ?? 240,
            lastUpdated: Date()
        )
        
        Task {
            await activity.update(using: contentState)
            call.resolve()
        }
    }
    
    @objc func end(_ call: CAPPluginCall) {
        guard #available(iOS 16.1, *) else {
            call.reject("Live Activities require iOS 16.1+")
            return
        }
        
        guard let activity = activity else {
            call.reject("No active Live Activity")
            return
        }
        
        Task {
            await activity.end(dismissalPolicy: .immediate)
            self.activity = nil
            call.resolve()
        }
    }
}
```

---

## Step 6: Register Plugin

Add to `ios/App/App/AppDelegate.swift`:

```swift
import LiveActivityPlugin

// In application(_:didFinishLaunchingWithOptions:)
// The plugin will be automatically registered by Capacitor
```

Create plugin definition file: `ios/App/App/LiveActivityPlugin.m`

```objc
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(LiveActivityPlugin, "LiveActivity",
    CAP_PLUGIN_METHOD(start, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(update, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(end, CAPPluginReturnPromise);
)
```

---

## Step 7: Update TypeScript Service

Update `src/services/liveActivityService.ts` to use the real plugin:

```typescript
import { Capacitor } from '@capacitor/core';

private async callNativeStartLiveActivity(sessionId: string, state: LiveActivityState): Promise<string | null> {
  try {
    const LiveActivity = Capacitor.Plugins.LiveActivity as any;
    const result = await LiveActivity.start({ sessionId, state });
    return result.activityId;
  } catch (error) {
    console.error('Native Live Activity start failed:', error);
    return null;
  }
}

private async callNativeUpdateLiveActivity(activityId: string, state: LiveActivityState): Promise<void> {
  try {
    const LiveActivity = Capacitor.Plugins.LiveActivity as any;
    await LiveActivity.update({ activityId, state });
  } catch (error) {
    console.error('Native Live Activity update failed:', error);
  }
}

private async callNativeEndLiveActivity(activityId: string): Promise<void> {
  try {
    const LiveActivity = Capacitor.Plugins.LiveActivity as any;
    await LiveActivity.end({ activityId });
  } catch (error) {
    console.error('Native Live Activity end failed:', error);
  }
}
```

---

## Step 8: Build and Test

### Build Requirements
- Physical iOS device (iOS 16.1+)
- iPhone 14 Pro/Pro Max for Dynamic Island testing
- Live Activities don't work in Simulator reliably

### Testing Steps
1. Build and run on physical device from Xcode
2. Start an effect tracking session in app
3. Lock the device
4. Verify Live Activity appears on lock screen
5. If iPhone 14 Pro+, check Dynamic Island
6. Unlock and verify updates continue
7. End session and verify Live Activity dismisses

---

## Step 9: Configure Signing & Capabilities

1. Select **App** target in Xcode
2. Go to **Signing & Capabilities** tab
3. Ensure **Background Modes** capability is added:
   - ✅ Background fetch
   - ✅ Background processing

4. Select **MeditraxLiveActivity** target
5. Configure same Team and Bundle ID pattern:
   - Bundle ID: `com.meditrax.app.MeditraxLiveActivity`

---

## Troubleshooting

### Live Activity doesn't appear
- Check iOS version (16.1+ required)
- Verify `NSSupportsLiveActivities` in Info.plist
- Check device settings: Settings → Face ID & Passcode → Allow access when locked
- Ensure app has notification permission

### Dynamic Island doesn't show
- Requires iPhone 14 Pro or newer
- Check if system Dynamic Island is enabled
- Verify widget extension is included in build

### Updates not working
- Check 20 updates/hour iOS limit
- Verify lastUpdated timestamp changes
- Check Xcode console for errors

---

## Live Activity UI Customization

### Modify Appearance
Edit `LockScreenLiveActivityView` in the Swift file to:
- Change colors (use medication color from state)
- Adjust layout
- Add/remove information
- Customize progress bar style

### Dynamic Island Customization
Modify the `dynamicIsland` section to:
- Change compact view layout
- Adjust expanded regions
- Customize minimal view

---

## Performance Considerations

- **Update Frequency**: Limit to once per minute (already implemented)
- **Battery Impact**: Live Activities are optimized by iOS, minimal drain
- **Duration Limit**: Live Activities auto-dismiss after 8 hours
- **Memory**: Each activity ~1-2 KB, negligible impact

---

## Future Enhancements

### Multiple Medications
- Support multiple concurrent Live Activities
- One per active effect session
- Max 2-3 recommended

### Interactive Actions (iOS 16.2+)
- Add buttons to Live Activity
- "Feeling It" / "Not Yet" quick feedback
- Direct medication logging

### Customization
- User-selectable Live Activity theme
- Show/hide specific information
- Configure update frequency

---

## Reference Links

- [Apple Live Activities Documentation](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities)
- [Dynamic Island Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/live-activities)
- [ActivityKit API Reference](https://developer.apple.com/documentation/activitykit)

---

*Note: This is a native iOS feature. Android and Desktop platforms will continue to use rich notifications for effect tracking.*

