# Changelog

All notable changes to Meditrax will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.1] - 2025-09-19

## [1.2.2] - 2025-09-25

### Fixed
- Dependency Prevention alerts no longer duplicate on each assessment; added merge-and-deduplicate logic with cooldowns (weekly for urgent, 3-day for pattern alerts)
- Resolved duplicate generation of Psychological Safety alerts on the dashboard by consolidating effect logic

### Improved
- Smart Messages are now rate-limited (max 3 per medication per 24h) and deduplicated within 12h to prevent spam
- Existing duplicate dependency alerts are collapsed on next assessment and alert history capped to last 50 items

### Added
- iOS PWA Web Push compatibility hardening: ensure VAPID subscription alongside FCM for Safari PWAs; weekly Web Push subscription health check (lightweight, non‑spamming)
- Service Worker message handlers: `STORE_REMINDER_PATTERN`, `DEACTIVATE_REMINDER_PATTERN`, `CANCEL_REMINDER_NOTIFICATIONS`, and `APP_VISIBILITY_CHANGED` to improve closed‑app delivery and reconciliation
- Backend health endpoint (`/health`) exposing VAPID configured status, Firestore access, project id, and timestamp for diagnostics
- GitHub Actions: Functions deploy workflow with Web Push config support; Pages workflow writes `.env` from Actions Variables (booleans) and Secrets (keys), includes CNAME copy and safe env presence check

### Changed
- Workbox PWA config now imports custom notification logic and Firebase messaging SW to guarantee diagnostic ping/handlers are active
- Backend token and schedule generation now deduplicate FCM tokens and only include current tokens in `scheduledNotifications`
- Backend reminder sync prunes removed reminders and prunes user FCM tokens not present in the latest sync
- Frontend backendSyncService no longer “sticks” disabled if permission wasn’t granted at first load; it re‑initializes and syncs on app load and on focus
- App boot/focus flow explicitly initializes backend, syncs data, and triggers backend scheduling for upcoming reminders
- Inventory/UI: refined Inventory page layout, dialog layering, and mobile scaling to match the shared modal pattern
- Import/Export: further hardened mapping and export (upserts, pill inventory preservation, safer date/number normalization)
- iOS Offline: improved SW caching and load timing to reduce offline blank loads when launched from Home Screen

### Fixed
- Resolved FCM token spam: frontend prefers cached token; backend deduplicates and prunes tokens; nightly stale token cleanup added
- Ensured user‑visible notifications for every push in SW (iOS requirement) and improved missed notification recovery when app regains focus
- Eliminated duplicate SW registration/import issues by consolidating imports via Workbox `importScripts`

### Improved
- iOS background notification reliability: dual‑path push (Web Push for Safari PWA, FCM for other platforms), periodic checks in SW, and consistent closed‑app scheduling via backend
- CI/CD and deployment ergonomics: environment variables handled in Pages workflow; Functions workflow manages VAPID config and deploys safely

## [1.1.2] - 2025-09-19

## [1.1.3] - 2025-09-20

### Fixed
- Inventory page now correctly detects inventory using multi‑pill data; no longer shows 0 after importing data

### Improved
- Import now upserts medications by id/name, preserves `pillInventory`, converts dates/numbers, remaps logs/reminders, and sets `pillsRemaining` from `pillInventory` for backwards compatibility
- Export respects the `includeLogs` option and includes metadata consistently
- Validation enhanced to check `pillInventory` structure and accept legacy `profile` field

### Fixed
- Inventory: Configuration dialog now reliably appears above all UI layers on the Inventory page and follows the shared modal pattern to prevent stacking issues

### Improved
- iOS Safari: Added body scroll locking and mobile-safe-area/mobile-scroll utilities to relevant modals for better WebKit behavior
- Mobile: Updated viewport meta to include `viewport-fit=cover` for proper safe-area handling on iOS devices
- Advanced Schedules: Refined Create Pattern tab with mobile-first inputs (no iOS zoom), numeric keyboard hints, and consistent spacing/components
 - Advanced Schedules: Added scrollable template categories with a larger library of cyclic dosing templates (5–2 on/off, alternate-day, 6–1, 4–3, pulse 2–5, pulse 3–4, 1w on/1w off, 21–7, 14–7, 10–20) and a quick tapering entry, aligned with app UI patterns
 - Advanced Schedules: Added Advanced templates (weekly step‑down, deload week, burst & stabilize, 3 on/1 low, reverse taper) and a collapsible Short Guide explaining how to apply and customize patterns
 - Search: Added background blur overlay on mobile and desktop, improved desktop overlay dismissal; fixed search navigation by preserving query when routing to pages; consistent glass UI on results dropdown
 - UI Theme: Subtle glass theme across surfaces (header, cards, results) using semi‑transparent backgrounds, softened borders, and backdrop blur

## [1.1.1] - 2025-09-18

### Improved
- **Complete UI Consistency Overhaul**: Applied consistent mobile-responsive design across all pages including Reports, Health Profile, Reminders, Calendar, and Inventory with standardized mobile classes and proper scaling
- **Enhanced Dialog and Modal Experience**: Fixed scrolling issues in all dialog pop-up boxes, added body scroll prevention, and improved mobile responsiveness for ConfirmDialog, MedicationModal, ReminderModal, and ExportModal
- **Calendar Mobile Optimization**: Completely redesigned calendar grid for mobile devices with responsive day heights, smart event display, touch-friendly navigation, and optimized spacing for small screens
- **Advanced Dosing Page Enhancements**: Fixed Create tab styling with proper mobile inputs and iOS-compatible form elements, and made Tapering tab fully functional with complete tapering plan management and active schedule display
- **Touch-Friendly Interface**: Implemented proper touch targets with minimum 44px heights, touch-manipulation CSS, and optimized button layouts for better mobile usability across the entire application
- **Responsive Layout Standards**: Established consistent layout patterns with mobile-safe-area, mobile-scroll, mobile-card, and mobile-button classes, ensuring uniform responsive behavior across all components

### Fixed
- **iOS Input Compatibility**: Added fontSize: '16px' to all input fields and select dropdowns to prevent iOS zoom behavior, ensuring smooth mobile experience across all forms and pages
- **React Import and Build Fixes**: Resolved React reference errors in ConfirmDialog component and fixed JSX syntax issues in Calendar component to ensure clean builds and error-free functionality

## [1.2.0] - 2025-09-17

### Improved
- **Settings Page Mobile Optimization**: Fixed mobile scaling issues in settings page with improved responsive design, better touch targets, and proper mobile-first styling
- **Enhanced Mobile Navigation**: Improved tab navigation and form layouts throughout the app for better mobile experience with optimized touch targets
- **Progressive Web App Features**: Enhanced PWA capabilities with better offline functionality, improved notification handling, and native app-like experience

### Fixed
- **Changelog Version Detection**: Fixed changelog modal not appearing for new versions when previously dismissed. The changelog now properly detects version changes

## [1.1.0] - 2025-09-16

### Added
- **Powder & Weight Unit Support**: Added support for tracking powdered medications with weight units (grams, milligrams, etc.) in inventory management and medication dashboard
- **Expanded Supplement Database**: Added comprehensive supplement varieties including CoQ10, NAD+, NAC, Alpha-GPC, Lion's Mane, Cordyceps, and other advanced nootropics
- **Recreational Drug Information**: Added detailed harm reduction information for recreational substances with PsychoNaut Wiki-standard dosage charts and safety guidelines
- **Version Changelog System**: Implemented changelog popup system to keep users informed about new features and improvements with each update

### Improved
- **Mobile UI Optimization**: Complete mobile interface overhaul with consistent scaling, better touch targets, and improved responsive design across all screens
- **Mobile Header Enhancement**: Moved Meditrax logo to header on mobile devices for better brand visibility and improved navigation space
- **Smart Inventory System**: Complete inventory overhaul with weight-based tracking, automatic unit conversion, and intelligent consumption calculation. Inventory units now automatically match dose units
- **Enhanced Medication Information**: Improved existing medication database entries with more comprehensive side effects, interactions, and safety information

### Fixed
- **Withdrawal Tracking Fixes**: Resolved issues with withdrawal tracking functionality, improved event initialization, and enhanced symptom logging accuracy

## [1.0.0] - 2025-09-15

### Added
- **Initial Release**: First stable release of Meditrax with comprehensive medication tracking, scheduling, and analytics features
- **Core Medication Management**: Complete medication management system with custom entries, pre-categorized types, dosage tracking, and inventory management with refill reminders
- **Smart Scheduling & Reminders**: Flexible scheduling system with daily, weekly, and custom frequencies, smart notifications, calendar views, and quick action capabilities
- **Analytics & Insights**: Comprehensive adherence tracking with visual charts, medication reports, trend analysis, and date range filtering for 7, 30, and 90-day periods
- **Progressive Web App Support**: Full PWA capabilities with mobile installation, offline functionality, push notifications, background sync, and native app-like experience
- **User Profiles & Data Management**: Personal health profiles with emergency contacts, data export/import functionality, customizable settings, and responsive design for all devices
- **Advanced Features**: Comprehensive medication database, harm reduction information, cyclic dosing patterns, tapering schedules, and withdrawal tracking capabilities

---

## Version History Notes

### Version Numbering
- **Major.Minor.Patch** format following semantic versioning
- **Major**: Breaking changes or significant feature overhauls
- **Minor**: New features and enhancements
- **Patch**: Bug fixes and minor improvements

### Categories
- **Added**: New features
- **Changed**: Changes in existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security-related changes
- **Improved**: Enhancements to existing features

### Known Issues
- **Tapering System**: Sometimes you may get an incorrect dosage. *Work in Progress*
- **PWA Push Notifications**: Push notifications may not send when app is closed. *Work in Progress*

For bug reports and feature requests, please visit our [GitHub Issues](https://github.com/dizzafizza/Meditrax/issues) page.
