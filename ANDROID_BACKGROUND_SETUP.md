# Android Background Tasks Setup Guide

## Overview
Configure Android app for background notification delivery and periodic task execution.

---

## Step 1: Update AndroidManifest.xml

File: `android/app/src/main/AndroidManifest.xml`

Add permissions:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.meditrax.app">

    <!-- Existing permissions -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.USE_BIOMETRIC" />
    <uses-permission android:name="android.permission.USE_FINGERPRINT" />
    
    <!-- Background and notification permissions -->
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
    <uses-permission android:name="android.permission.USE_EXACT_ALARM" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />
    
    <application
        android:name=".MainApplication"
        android:allowBackup="true"
        ...
    >
        <!-- Existing activity -->
        <activity ...></activity>
        
        <!-- Boot receiver for notification rescheduling -->
        <receiver
            android:name=".BootReceiver"
            android:enabled="true"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.QUICKBOOT_POWERON" />
            </intent-filter>
        </receiver>
    </application>
</manifest>
```

---

## Step 2: Create Boot Receiver (Optional)

If you want to reschedule notifications on device restart:

File: `android/app/src/main/java/com/meditrax/app/BootReceiver.java`

```java
package com.meditrax.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class BootReceiver extends BroadcastReceiver {
    private static final String TAG = "MeditraxBootReceiver";
    
    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            Log.d(TAG, "Device booted - notifications will be rescheduled on app launch");
            
            // Capacitor Local Notifications will reschedule automatically
            // when the app next opens
        }
    }
}
```

---

## Step 3: Configure Notification Channels

File: `android/app/src/main/java/com/meditrax/app/MainActivity.java`

Add notification channels in `onCreate`:

```java
package com.meditrax.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Create notification channels
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            createNotificationChannels();
        }
    }
    
    private void createNotificationChannels() {
        NotificationManager manager = getSystemService(NotificationManager.class);
        
        // Medication Reminders Channel
        NotificationChannel reminders = new NotificationChannel(
            "medication-reminders",
            "Medication Reminders",
            NotificationManager.IMPORTANCE_HIGH
        );
        reminders.setDescription("Daily medication reminder notifications");
        reminders.enableVibration(true);
        reminders.enableLights(true);
        manager.createNotificationChannel(reminders);
        
        // Critical Alerts Channel
        NotificationChannel critical = new NotificationChannel(
            "critical-alerts",
            "Critical Health Alerts",
            NotificationManager.IMPORTANCE_HIGH
        );
        critical.setDescription("Urgent medication alerts requiring attention");
        critical.enableVibration(true);
        critical.enableLights(true);
        manager.createNotificationChannel(critical);
        
        // Inventory Alerts Channel
        NotificationChannel inventory = new NotificationChannel(
            "inventory-alerts",
            "Inventory Alerts",
            NotificationManager.IMPORTANCE_DEFAULT
        );
        inventory.setDescription("Low supply and refill reminders");
        manager.createNotificationChannel(inventory);
        
        // Effect Tracking Channel
        NotificationChannel effects = new NotificationChannel(
            "effect-tracking",
            "Effect Tracking",
            NotificationManager.IMPORTANCE_LOW
        );
        effects.setDescription("Effect onset, peak, and wear-off notifications");
        effects.setSound(null, null); // Silent
        manager.createNotificationChannel(effects);
        
        // Achievements Channel
        NotificationChannel achievements = new NotificationChannel(
            "achievements",
            "Achievements",
            NotificationManager.IMPORTANCE_LOW
        );
        achievements.setDescription("Streak milestones and celebrations");
        manager.createNotificationChannel(achievements);
    }
}
```

---

## Step 4: Add Notification Icons

Place notification icons in:
```
android/app/src/main/res/drawable/
  ├── ic_stat_icon_config_sample.png (white, transparent, 24dp)
  └── ic_notification.png (colored app icon)
```

Requirements:
- White silhouette on transparent background
- 24x24dp size
- PNG format
- Place in all density folders (mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi)

---

## Step 5: Test on Android

### Enable Background Restrictions
Test with aggressive battery optimization:
1. Settings → Apps → Meditrax → Battery
2. Set to "Unrestricted" for reliable notifications
3. Test with "Optimized" to verify fallback behavior

### Test Scenarios
1. **Exact Alarm Delivery**:
   - Schedule medication reminder
   - Close app completely
   - Verify notification arrives at exact time

2. **Boot Persistence**:
   - Schedule notifications
   - Restart device
   - Open app
   - Verify notifications rescheduled

3. **Effect Tracking**:
   - Start effect session
   - Close app
   - Verify milestone notifications arrive
   - Reopen app
   - Verify session restored

---

## Step 6: Handle Android 13+ Permissions

For Android 13 (API 33+), request notification permission at runtime:

This is already handled by Capacitor Local Notifications plugin, but you can enhance it:

```typescript
// In App.tsx or Settings.tsx
if (isAndroid()) {
  const androidVersion = await getAndroidVersion();
  if (androidVersion >= 13) {
    // Permission request handled by Capacitor
    await LocalNotifications.requestPermissions();
  }
}
```

---

## Troubleshooting

### Notifications not delivered when app closed
- Check battery optimization settings
- Verify SCHEDULE_EXACT_ALARM permission
- Ensure notification channels created
- Check Do Not Disturb settings

### Notifications delayed
- Android may batch notifications for battery saving
- Use HIGH importance for time-sensitive alerts
- Request "Unrestricted" battery mode for critical apps

### Boot receiver not working
- Verify receiver declared in manifest
- Check exported="true" attribute
- Test on device (not emulator for boot events)

---

## Alternative: Rich Notifications (Instead of Live Activities)

Since Android doesn't have Live Activities, use rich notifications for effect tracking:

### Custom Notification Layout

Create custom notification with:
- Progress bar showing effect phase
- Current status ("Peaking in 15 min")
- Quick action buttons
- Auto-updating every minute

This provides similar functionality to iOS Live Activities but through notifications.

---

## Performance Tips

- Use notification channels appropriately (different importance levels)
- Batch updates when possible
- Respect user's notification preferences
- Test on low-end devices
- Monitor battery usage in Android Vitals

---

*Note: Android background execution is more flexible than iOS but still has restrictions. Use Local Notifications as the primary mechanism for background tasks.*

