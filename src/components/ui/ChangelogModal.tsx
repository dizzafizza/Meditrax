import React from 'react';
import { X, CheckCircle, Star, Zap, Shield, Smartphone } from 'lucide-react';

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
  version: string;
}

interface ChangelogEntry {
  version: string;
  date: string;
  changes: {
    type: 'new' | 'improved' | 'fixed' | 'security';
    icon: React.ReactNode;
    title: string;
    description: string;
  }[];
}

const CHANGELOG_DATA: ChangelogEntry[] = [
  {
    version: "1.2.0",
    date: "2025-9-19",
    changes: [
      {
        type: 'new',
        icon: <Star className="h-4 w-4" />,
        title: "Subtle Glass UI Theme",
        description: "Introduced reusable glass-panel and glass-overlay utilities and applied them across dialogs, panels, and sticky headers while preserving the existing color palette."
      },
      {
        type: 'improved',
        icon: <CheckCircle className="h-4 w-4" />,
        title: "Consistent, iOS-safe Modals",
        description: "Standardized modal structure with mobile-safe-area, mobile-scroll, body scroll-lock, and increased z-layer. Inventory Configuration and Medication dialogs now render via portal at z-[80] to always appear on top."
      },
      {
        type: 'improved',
        icon: <Zap className="h-4 w-4" />,
        title: "Multiple Pills Setup Scaling",
        description: "Unified inputs to app styling, fixed scaling on mobile, added safe-area scrolling, and aligned with the rest of the UI."
      },
      {
        type: 'improved',
        icon: <Smartphone className="h-4 w-4" />,
        title: "Search UX Overhaul (Safari friendly)",
        description: "Enter now selects the best match even before results debounce. Page navigation preserves ?q and hydrates search on arrival. Added fallback to open Add Medication prefilled, and returning to the previous page after closing the dialog. Global key handling works even when the dropdown is hidden."
      },
      {
        type: 'fixed',
        icon: <CheckCircle className="h-4 w-4" />,
        title: "Medication Dialog Visibility & Autofill",
        description: "Fixed cases where the Add Medication dialog opened behind the header or without prefill. Dialog now portals to body and auto-fills from ?add= reliably."
      },
      {
        type: 'improved',
        icon: <Zap className="h-4 w-4" />,
        title: "Advanced Schedules – Create Pattern",
        description: "Added template categories, advanced phase options (repeat/ramp), refined card text alignment and wrapping, and a brief guide for new users."
      },
      {
        type: 'improved',
        icon: <Shield className="h-4 w-4" />,
        title: "Header & Navigation Polish",
        description: "Centered Meditrax logo between search and menu, centered menu icon, and added subtle background blur when searching."
      },
      {
        type: 'fixed',
        icon: <Smartphone className="h-4 w-4" />,
        title: "iOS Input Zoom",
        description: "Ensured 16px base font size on inputs/selects to prevent Safari auto-zoom while typing."
      }
    ]
  },
  {
    version: "1.1.1",
    date: "2025-9-18",
    changes: [
      {
        type: 'improved',
        icon: <Smartphone className="h-4 w-4" />,
        title: "Complete UI Consistency Overhaul",
        description: "Applied consistent mobile-responsive design across all pages including Reports, Health Profile, Reminders, Calendar, and Inventory with standardized mobile classes and proper scaling."
      },
      {
        type: 'improved',
        icon: <Smartphone className="h-4 w-4" />,
        title: "Enhanced Dialog and Modal Experience",
        description: "Fixed scrolling issues in all dialog pop-up boxes, added body scroll prevention, and improved mobile responsiveness for ConfirmDialog, MedicationModal, ReminderModal, and ExportModal."
      },
      {
        type: 'improved',
        icon: <CheckCircle className="h-4 w-4" />,
        title: "Calendar Mobile Optimization",
        description: "Completely redesigned calendar grid for mobile devices with responsive day heights, smart event display, touch-friendly navigation, and optimized spacing for small screens."
      },
      {
        type: 'improved',
        icon: <Zap className="h-4 w-4" />,
        title: "Advanced Dosing Page Enhancements",
        description: "Fixed Create tab styling with proper mobile inputs and iOS-compatible form elements, and made Tapering tab fully functional with complete tapering plan management and active schedule display."
      },
      {
        type: 'fixed',
        icon: <CheckCircle className="h-4 w-4" />,
        title: "iOS Input Compatibility",
        description: "Added fontSize: '16px' to all input fields and select dropdowns to prevent iOS zoom behavior, ensuring smooth mobile experience across all forms and pages."
      },
      {
        type: 'fixed',
        icon: <CheckCircle className="h-4 w-4" />,
        title: "React Import and Build Fixes",
        description: "Resolved React reference errors in ConfirmDialog component and fixed JSX syntax issues in Calendar component to ensure clean builds and error-free functionality."
      },
      {
        type: 'improved',
        icon: <Smartphone className="h-4 w-4" />,
        title: "Touch-Friendly Interface",
        description: "Implemented proper touch targets with minimum 44px heights, touch-manipulation CSS, and optimized button layouts for better mobile usability across the entire application."
      },
      {
        type: 'improved',
        icon: <Zap className="h-4 w-4" />,
        title: "Responsive Layout Standards",
        description: "Established consistent layout patterns with mobile-safe-area, mobile-scroll, mobile-card, and mobile-button classes, ensuring uniform responsive behavior across all components."
      }
    ]
  },
  {
    version: "1.1.0",
    date: "2025-9-17",
    changes: [
      {
        type: 'improved',
        icon: <Smartphone className="h-4 w-4" />,
        title: "Settings Page Mobile Optimization",
        description: "Fixed mobile scaling issues in settings page with improved responsive design, better touch targets, and proper mobile-first styling."
      },
      {
        type: 'fixed',
        icon: <CheckCircle className="h-4 w-4" />,
        title: "Changelog Version Detection",
        description: "Fixed changelog modal not appearing for new versions when previously dismissed. The changelog now properly detects version changes."
      },
      {
        type: 'improved',
        icon: <Smartphone className="h-4 w-4" />,
        title: "Enhanced Mobile Navigation",
        description: "Improved tab navigation and form layouts throughout the app for better mobile experience with optimized touch targets."
      },
      {
        type: 'improved',
        icon: <Zap className="h-4 w-4" />,
        title: "Progressive Web App Features",
        description: "Enhanced PWA capabilities with better offline functionality, improved notification handling, and native app-like experience."
      },
      {
        type: 'improved',
        icon: <Smartphone className="h-4 w-4" />,
        title: "Mobile UI Optimization",
        description: "Complete mobile interface overhaul with consistent scaling, better touch targets, and improved responsive design across all screens."
      },
      {
        type: 'improved',
        icon: <Smartphone className="h-4 w-4" />,
        title: "Mobile Header Enhancement", 
        description: "Moved Meditrax logo to header on mobile devices for better brand visibility and improved navigation space."
      },
      {
        type: 'fixed',
        icon: <CheckCircle className="h-4 w-4" />,
        title: "Withdrawal Tracking Fixes",
        description: "Resolved issues with withdrawal tracking functionality, improved event initialization, and enhanced symptom logging accuracy."
      },
      {
        type: 'new',
        icon: <Star className="h-4 w-4" />,
        title: "Powder & Weight Unit Support",
        description: "Added support for tracking powdered medications with weight units (grams, milligrams, etc.) in inventory management and medication dashboard."
      },
      {
        type: 'improved',
        icon: <Zap className="h-4 w-4" />,
        title: "Smart Inventory System",
        description: "Complete inventory overhaul with weight-based tracking, automatic unit conversion, and intelligent consumption calculation. Inventory units now automatically match dose units."
      },
      {
        type: 'new',
        icon: <Star className="h-4 w-4" />,
        title: "Expanded Supplement Database",
        description: "Added comprehensive supplement varieties including CoQ10, NAD+, NAC, Alpha-GPC, Lion's Mane, Cordyceps, and other advanced nootropics."
      },
      {
        type: 'new',
        icon: <Shield className="h-4 w-4" />,
        title: "Recreational Drug Information",
        description: "Added detailed harm reduction information for recreational substances with PsychoNaut Wiki-standard dosage charts and safety guidelines."
      },
      {
        type: 'improved',
        icon: <CheckCircle className="h-4 w-4" />,
        title: "Enhanced Medication Information",
        description: "Improved existing medication database entries with more comprehensive side effects, interactions, and safety information."
      },
      {
        type: 'new',
        icon: <Star className="h-4 w-4" />,
        title: "Version Changelog System",
        description: "Implemented this changelog popup system to keep users informed about new features and improvements with each update."
      }
    ]
  },
  {
    version: "1.0.0",
    date: "2025-9-15",
    changes: [
      {
        type: 'new',
        icon: <Star className="h-4 w-4" />,
        title: "Initial Release",
        description: "First stable release of Meditrax with comprehensive medication tracking, scheduling, and analytics features."
      },
      {
        type: 'new',
        icon: <Zap className="h-4 w-4" />,
        title: "Core Medication Management",
        description: "Complete medication management system with custom entries, pre-categorized types, dosage tracking, and inventory management with refill reminders."
      },
      {
        type: 'new',
        icon: <Smartphone className="h-4 w-4" />,
        title: "Smart Scheduling & Reminders",
        description: "Flexible scheduling system with daily, weekly, and custom frequencies, smart notifications, calendar views, and quick action capabilities."
      },
      {
        type: 'new',
        icon: <CheckCircle className="h-4 w-4" />,
        title: "Analytics & Insights",
        description: "Comprehensive adherence tracking with visual charts, medication reports, trend analysis, and date range filtering for 7, 30, and 90-day periods."
      },
      {
        type: 'new',
        icon: <Shield className="h-4 w-4" />,
        title: "Progressive Web App Support",
        description: "Full PWA capabilities with mobile installation, offline functionality, push notifications, background sync, and native app-like experience."
      },
      {
        type: 'new',
        icon: <Star className="h-4 w-4" />,
        title: "User Profiles & Data Management",
        description: "Personal health profiles with emergency contacts, data export/import functionality, customizable settings, and responsive design for all devices."
      },
      {
        type: 'new',
        icon: <Zap className="h-4 w-4" />,
        title: "Advanced Features",
        description: "Comprehensive medication database, harm reduction information, cyclic dosing patterns, tapering schedules, and withdrawal tracking capabilities."
      }
    ]
  }
];

export function ChangelogModal({ isOpen, onClose, version }: ChangelogModalProps) {
  const [showAllVersions, setShowAllVersions] = React.useState(false);

  // Prevent body scroll when modal is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen]);

  const changelogEntry = CHANGELOG_DATA.find(entry => entry.version === version);
  
  if (!isOpen || !changelogEntry) return null;

  const versionsToShow = showAllVersions ? CHANGELOG_DATA : [changelogEntry];
  const hasOlderVersions = CHANGELOG_DATA.length > 1;

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'new': return 'bg-green-100 text-green-800 border-green-200';
      case 'improved': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'fixed': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'security': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'new': return 'New';
      case 'improved': return 'Improved';
      case 'fixed': return 'Fixed';
      case 'security': return 'Security';
      default: return 'Change';
    }
  };

  return (
    <div className="fixed inset-0 glass-overlay flex items-center justify-center p-3 sm:p-4 z-[60] mobile-safe-area">
      <div className="glass-panel rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] sm:max-h-[90vh] overflow-hidden mobile-modal flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-4 sm:px-6 py-3 sm:py-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
              <div className="h-8 w-8 sm:h-10 sm:w-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center flex-shrink-0">
                <Star className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg sm:text-xl font-bold truncate">What's New</h2>
                <p className="text-primary-100 text-sm sm:text-base truncate">Version {changelogEntry.version} • {changelogEntry.date}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-primary-100 transition-colors p-1 sm:p-2 hover:bg-white hover:bg-opacity-10 rounded-lg flex-shrink-0 ml-2"
            >
              <X className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto mobile-scroll">
          <div className="space-y-6">
            {!showAllVersions ? (
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  🎉 Welcome to Meditrax v{changelogEntry.version} (Beta)
                </h3>
                <p className="text-gray-600">
                  We've been working hard to improve your medication tracking experience. Here's what's new:
                </p>
              </div>
            ) : (
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  📋 Meditrax Version History
                </h3>
                <p className="text-gray-600">
                  Complete changelog showing all updates and improvements to Meditrax:
                </p>
              </div>
            )}

            {versionsToShow.map((versionEntry, versionIndex) => (
              <div key={versionEntry.version} className="space-y-4">
                {showAllVersions && (
                  <div className="border-l-4 border-primary-500 pl-4 mb-4">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Version {versionEntry.version}
                      </h3>
                      <span className="px-2 py-1 bg-primary-100 text-primary-800 text-xs font-medium rounded-full">
                        {versionEntry.date}
                      </span>
                    </div>
                  </div>
                )}
                
                <div className="space-y-4">
                  {versionEntry.changes.map((change, index) => (
                    <div key={`${versionEntry.version}-${index}`} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                      <div className="flex items-start space-x-3">
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${getTypeColor(change.type)} border`}>
                          {change.icon}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h4 className="font-medium text-gray-900">{change.title}</h4>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getTypeColor(change.type)}`}>
                              {getTypeLabel(change.type)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">{change.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {showAllVersions && versionIndex < versionsToShow.length - 1 && (
                  <div className="border-b border-gray-200 pb-6"></div>
                )}
              </div>
            ))}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-blue-900 mb-1">Important Note</h4>
                  <p className="text-sm text-blue-800">
                    This is a beta release. If you encounter any issues or have feedback, 
                    please open an issue on the GitHub page so we could promptly fix it. Your data remains private and secure.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 flex-shrink-0">
          <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
              <p className="text-sm text-gray-500 text-center sm:text-left">
                Thank you for using Meditrax! 🏥
              </p>
              {hasOlderVersions && !showAllVersions && (
                <button
                  onClick={() => setShowAllVersions(true)}
                  className="mobile-button text-sm text-primary-600 hover:text-primary-700 font-medium underline min-h-[44px] flex items-center justify-center"
                >
                  Show Previous Versions
                </button>
              )}
              {showAllVersions && (
                <button
                  onClick={() => setShowAllVersions(false)}
                  className="mobile-button text-sm text-primary-600 hover:text-primary-700 font-medium underline min-h-[44px] flex items-center justify-center"
                >
                  Show Current Only
                </button>
              )}
            </div>
            <button
              onClick={onClose}
              className="mobile-button btn-primary w-full sm:w-auto min-h-[44px] flex items-center justify-center"
            >
              {showAllVersions ? 'Close' : 'Get Started'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
