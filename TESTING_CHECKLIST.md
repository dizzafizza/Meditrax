# Meditrax v2.0 - iOS 26 UI Testing Checklist

## Pre-Flight Checks

### Dependencies & Build
- [ ] Run `npm install` to install `@ionic/react-router`
- [ ] Run `npm run build` to verify Vite build succeeds
- [ ] Run `npm run cap:sync` to sync with native projects
- [ ] Verify no TypeScript errors: `npx tsc --noEmit`
- [ ] Run validation script: `./scripts/validate-ionic-migration.sh`

## Functional Testing

### Navigation - Tab Bar (Bottom)
- [ ] **Dashboard tab** - Navigates to `/dashboard`
- [ ] **Medications tab** - Navigates to `/medications`
- [ ] **Calendar tab** - Navigates to `/calendar`
- [ ] **Reminders tab** - Navigates to `/reminders`
- [ ] **Settings tab** - Navigates to `/settings`
- [ ] Active tab is highlighted with iOS 26 blue
- [ ] Smooth transitions between tabs (280ms spring)

### Navigation - Side Menu
- [ ] Menu opens via hamburger icon or swipe (iOS)
- [ ] **Primary section:** Dashboard, Medications, Inventory, Calendar, Analytics, Settings
- [ ] **Secondary section:** Advanced Schedules, Effects Tracker, Wiki, Reminders, Reports, Health Profile
- [ ] Menu auto-closes after selection (mobile)
- [ ] Menu stays open on desktop/tablet (split-pane)
- [ ] `routerLink` navigation works for all items

### Page Structure
Test each page has proper Ionic structure:

#### Dashboard
- [ ] Large title "Dashboard" appears
- [ ] Title collapses on scroll
- [ ] Header is translucent (blur effect visible)
- [ ] All cards and stats render correctly
- [ ] TodaysMedications component functional
- [ ] Effect tracking displays
- [ ] Smart alerts visible
- [ ] Modals (Dependency, Tapering, Withdrawal) open correctly

#### Medications
- [ ] IonSearchbar appears and filters medications
- [ ] Add button in toolbar works
- [ ] Category filter dropdown functional
- [ ] Medication cards render
- [ ] Actions menu (•••) opens on card
- [ ] Edit, delete, tapering options work
- [ ] Modal opens for add/edit

#### Calendar
- [ ] Large title "Calendar" collapses
- [ ] IonSegment switches between Week/Month views
- [ ] Medication filter dropdown works
- [ ] Calendar grid renders
- [ ] Day selection highlights
- [ ] Events display in sidebar
- [ ] Color coding shows for medications

#### Reminders
- [ ] Reminder cards display
- [ ] Toggle switches work (active/inactive)
- [ ] Add reminder button functional
- [ ] Smart adherence insights visible
- [ ] Edit and delete actions work
- [ ] Snooze buttons functional

#### Settings
- [ ] Tabs navigation works (Profile, Notifications, Security, PWA, Data, Diagnostics)
- [ ] Forms save correctly
- [ ] Toggles and checkboxes respond
- [ ] Notification permission flow works
- [ ] Export/import modals open
- [ ] Biometric settings functional (native only)

#### Inventory
- [ ] PersonalMedicationDashboard renders
- [ ] Inventory tracking displays
- [ ] Refill alerts visible

#### Effects Tracker
- [ ] Active sessions display
- [ ] EffectTimer components work
- [ ] Recent sessions list shows
- [ ] Feedback buttons functional

#### Analytics
- [ ] Charts render without errors
- [ ] Date range selector works
- [ ] Medication filter functional
- [ ] Export button opens modal

#### Reports
- [ ] Report tabs switch (Adherence, Side Effects, Summary)
- [ ] Date range pickers work
- [ ] Sample data loads
- [ ] Export functions work

#### Wiki
- [ ] Section navigation works
- [ ] Content scrollable
- [ ] Links functional

#### Health Profile
- [ ] Edit mode toggles
- [ ] Form fields save
- [ ] Allergies/conditions add/remove
- [ ] Emergency contact updates

#### Cyclic Dosing
- [ ] Tab switching (Patterns, Tapering, Active)
- [ ] Pattern creation works
- [ ] Templates apply
- [ ] Active patterns display

## Visual Testing

### iOS Design (Test on iPhone or iOS Simulator)
- [ ] Large titles (34px, bold) display correctly
- [ ] Titles collapse smoothly on scroll
- [ ] Headers are translucent with blur effect visible
- [ ] Tab bar is translucent (can see content scroll behind)
- [ ] Safe areas respected (no content behind notch/home indicator)
- [ ] Swipe-to-go-back gestures work
- [ ] SF Pro font renders
- [ ] iOS 26 blue (#007AFF) used for primary actions
- [ ] Spring animations feel native (not linear)
- [ ] Status bar style matches (dark content on light background)

### Android Design (Test on Android device/emulator)
- [ ] Material Design tab bar (with shadow)
- [ ] Ripple effects on buttons
- [ ] Hardware back button works correctly
- [ ] Material transitions (not iOS spring)
- [ ] Roboto font used
- [ ] Bottom tab bar has elevation

### Dark Mode (Toggle in device settings)
- [ ] Background is pure black (#000000) on iOS
- [ ] Text is white/light gray
- [ ] Toolbars/tab bars use dark translucent material
- [ ] Cards have dark background (#1c1c1e)
- [ ] Colors shift to iOS 26 dark palette:
  - Primary: #0A84FF
  - Success: #30D158
  - Warning: #FF9F0A
  - Danger: #FF453A

### Responsive Design
- [ ] **Desktop (>1024px):** Split-pane shows menu permanently
- [ ] **Tablet (768-1024px):** Menu toggles, tabs visible
- [ ] **Mobile (<768px):** Full-screen pages, bottom tabs only
- [ ] Touch targets ≥44px on mobile
- [ ] Text is readable at all sizes

## Capacitor Integration

### iOS Native Features
- [ ] App launches with splash screen (iOS 26 blue)
- [ ] Status bar configured correctly (dark style, no overlay)
- [ ] Safe areas respected (notch, home indicator, Dynamic Island)
- [ ] Local notifications work when app is closed
- [ ] Camera access works (if used)
- [ ] Biometric authentication functional
- [ ] Haptic feedback triggers on actions

### Android Native Features
- [ ] App launches with splash screen
- [ ] Status bar configured
- [ ] Hardware back button navigates correctly (back vs exit app)
- [ ] Local notifications work in background
- [ ] Camera access works (if used)
- [ ] Fingerprint authentication works

### Cross-Platform
- [ ] App works offline
- [ ] Data persists across sessions
- [ ] Preferences save correctly
- [ ] Export/import preserves data

## Performance Testing

### Load Performance
- [ ] Initial page load <2s on 3G
- [ ] Page transitions <300ms
- [ ] No visible layout shifts
- [ ] Smooth scrolling (60fps)

### Memory
- [ ] No memory leaks when navigating
- [ ] Images load efficiently
- [ ] Charts don't cause performance issues

### Accessibility
- [ ] Reduced motion respected (animations disabled if user prefers)
- [ ] VoiceOver/TalkBack can navigate (test screen readers)
- [ ] Color contrast meets WCAG AA
- [ ] Focus indicators visible

## Integration Testing

### Data Flow
- [ ] Add medication → appears in all relevant pages
- [ ] Log medication → updates dashboard, calendar, analytics
- [ ] Edit medication → changes propagate
- [ ] Delete medication → removes from all views
- [ ] Reminders trigger at correct times
- [ ] Effect sessions track correctly

### Modal Interactions
- [ ] Modals open above tab bar
- [ ] Multiple modals stack correctly
- [ ] Modal close animations smooth
- [ ] Form data saves on modal close
- [ ] Modals respect safe areas

### Search & Filters
- [ ] IonSearchbar filters medications in real-time
- [ ] Category filter works
- [ ] Global search navigates correctly
- [ ] Search results clear properly

## Edge Cases

### Empty States
- [ ] No medications: Shows appropriate empty state
- [ ] No reminders: Shows setup prompt
- [ ] No logs: Shows getting started message
- [ ] Calendar with no events: Shows empty day message

### Error Handling
- [ ] Invalid date inputs handled
- [ ] Network errors don't crash app (offline mode)
- [ ] Permission denials graceful (camera, notifications)
- [ ] Corrupt data migration handled

### Special Scenarios
- [ ] First-time user experience
- [ ] Migrating from v1.x data
- [ ] Large datasets (100+ medications)
- [ ] Long medication names
- [ ] Special characters in names/notes

## Platform-Specific Testing

### iOS Simulator Testing
```bash
npm run ios:dev
```
- [ ] Run on iPhone 15 Pro (test Dynamic Island)
- [ ] Run on iPhone SE (test without notch)
- [ ] Run on iPad (test split-pane)

### Android Emulator Testing
```bash
npm run android:dev
```
- [ ] Run on Pixel 8 (test Material Design)
- [ ] Run on tablet emulator (test responsive layout)

### Web Testing
```bash
npm run dev
```
- [ ] Chrome (latest)
- [ ] Safari (latest)
- [ ] Firefox (latest)
- [ ] Edge (latest)

## Regression Testing

Verify existing features still work:

### Core Features
- [ ] Medication logging
- [ ] Adherence tracking
- [ ] Inventory management
- [ ] Tapering schedules
- [ ] Cyclic dosing patterns
- [ ] Dependency prevention
- [ ] Psychological safety alerts
- [ ] Side effect reporting
- [ ] Withdrawal tracking
- [ ] Effect timing calibration

### Notifications
- [ ] Scheduled reminders fire
- [ ] Notification actions work (Take, Snooze, Skip)
- [ ] Badge counts update
- [ ] Alert notifications appear

### Data Management
- [ ] Export JSON works
- [ ] Export CSV works
- [ ] Import restores data correctly
- [ ] Clear all data works

## Sign-Off

When all checks pass:

1. ✅ Validation script passes: `./scripts/validate-ionic-migration.sh`
2. ✅ All functional tests complete
3. ✅ Visual tests on iOS and Android pass
4. ✅ Performance acceptable
5. ✅ No regressions found

**Migration Status:** ✅ READY FOR PRODUCTION

**Tested By:** _________________

**Date:** _________________

**Notes:**
_______________________________________________________________________
_______________________________________________________________________
_______________________________________________________________________

