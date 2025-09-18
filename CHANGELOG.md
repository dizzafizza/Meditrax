# Changelog

All notable changes to Meditrax will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
