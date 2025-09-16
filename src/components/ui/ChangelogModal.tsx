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
    version: "1.1.0",
    date: "2025-9-16",
    changes: [
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
        description: "Moved MedTrack logo to header on mobile devices for better brand visibility and improved navigation space."
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
  }
];

export function ChangelogModal({ isOpen, onClose, version }: ChangelogModalProps) {
  const changelogEntry = CHANGELOG_DATA.find(entry => entry.version === version);
  
  if (!isOpen || !changelogEntry) return null;

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
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                <Star className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold">What's New</h2>
                <p className="text-primary-100">Version {changelogEntry.version} • {changelogEntry.date}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-primary-100 transition-colors p-2 hover:bg-white hover:bg-opacity-10 rounded-lg"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                🎉 Welcome to MedTrack v{changelogEntry.version} (Beta)
              </h3>
              <p className="text-gray-600">
                We've been working hard to improve your medication tracking experience. Here's what's new:
              </p>
            </div>

            <div className="space-y-4">
              {changelogEntry.changes.map((change, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
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

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-blue-900 mb-1">Important Note</h4>
                  <p className="text-sm text-blue-800">
                    This is a beta release. If you encounter any issues or have feedback, 
                    please let us know through the settings page. Your data remains private and secure.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Thank you for using MedTrack! 🏥
            </p>
            <button
              onClick={onClose}
              className="btn-primary"
            >
              Get Started
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
