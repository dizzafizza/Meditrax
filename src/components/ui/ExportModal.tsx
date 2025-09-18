import React from 'react';
import { 
  X, 
  Download, 
  FileText, 
  Database,
  Settings as SettingsIcon
} from 'lucide-react';
import { useMedicationStore } from '@/store';
import { downloadFile } from '@/utils/helpers';
import toast from 'react-hot-toast';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExportModal({ isOpen, onClose }: ExportModalProps) {
  const { 
    exportDataWithOptions, 
    exportToCSV,
    exportToPDF 
  } = useMedicationStore();

  const [exportOptions, setExportOptions] = React.useState({
    format: 'json' as 'json' | 'csv' | 'pdf',
    includeMedications: true,
    includeLogs: true,
    includeReminders: true,
    includeProfile: true,
    includePersonalInfo: true,
    includeAdvancedFeatures: false,
    dateRange: {
      enabled: false,
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      end: new Date()
    }
  });

  const [isExporting, setIsExporting] = React.useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      let data: string;
      let filename: string;
      let mimeType: string;

      const dateStr = new Date().toISOString().split('T')[0];

      switch (exportOptions.format) {
        case 'json':
          data = await exportDataWithOptions({
            ...exportOptions,
            dateRange: exportOptions.dateRange.enabled ? exportOptions.dateRange : undefined
          });
          filename = `meditrax-export-${dateStr}.json`;
          mimeType = 'application/json';
          break;

        case 'csv':
          data = exportToCSV('all', exportOptions.dateRange.enabled ? exportOptions.dateRange : undefined);
          filename = `meditrax-export-${dateStr}.csv`;
          mimeType = 'text/csv';
          break;

        case 'pdf':
          data = await exportToPDF(exportOptions);
          filename = `meditrax-export-${dateStr}.json`; // PDF would be .pdf in real implementation
          mimeType = 'application/json';
          break;

        default:
          throw new Error('Invalid export format');
      }

      downloadFile(data, filename, mimeType);
      toast.success(`Data exported as ${exportOptions.format.toUpperCase()} successfully`);
      onClose();
    } catch (error) {
      toast.error('Failed to export data');
      // Error handled by toast notification
    } finally {
      setIsExporting(false);
    }
  };

  // Prevent body scroll when modal is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 mobile-safe-area">
      <div className="bg-white rounded-lg max-w-2xl w-full mobile-modal overflow-hidden">
        <div className="max-h-[90vh] overflow-y-auto mobile-scroll">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Download className="h-6 w-6 text-blue-600" />
            <h3 className="text-lg font-medium text-gray-900">Export Data</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Export Format */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Export Format</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'json', label: 'JSON', icon: Database, description: 'Complete data with metadata' },
                { value: 'csv', label: 'CSV', icon: FileText, description: 'Spreadsheet compatible' },
                { value: 'pdf', label: 'PDF', icon: FileText, description: 'Formatted report (Coming soon)' }
              ].map((format) => (
                <button
                  key={format.value}
                  onClick={() => setExportOptions(prev => ({ ...prev, format: format.value as any }))}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    exportOptions.format === format.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  disabled={format.value === 'pdf'}
                >
                  <format.icon className={`h-6 w-6 mx-auto mb-2 ${
                    exportOptions.format === format.value ? 'text-blue-600' : 'text-gray-400'
                  }`} />
                  <div className="text-sm font-medium text-gray-900">{format.label}</div>
                  <div className="text-xs text-gray-500 mt-1">{format.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Data Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Data to Include</label>
            <div className="space-y-3">
              {[
                { key: 'includeMedications', label: 'Medications', description: 'All medication records and details' },
                { key: 'includeLogs', label: 'Medication Logs', description: 'Dosage history and adherence data' },
                { key: 'includeReminders', label: 'Reminders', description: 'Notification schedules and settings' },
                { key: 'includeProfile', label: 'Health Profile', description: 'Personal health information' },
                { key: 'includeAdvancedFeatures', label: 'Advanced Features', description: 'Smart messages, risk assessments, etc.' }
              ].map((item) => (
                <label key={item.key} className="flex items-start space-x-3">
                  <input
                    type="checkbox"
                    checked={exportOptions[item.key as keyof typeof exportOptions] as boolean}
                    onChange={(e) => setExportOptions(prev => ({ 
                      ...prev, 
                      [item.key]: e.target.checked 
                    }))}
                    className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{item.label}</div>
                    <div className="text-xs text-gray-500">{item.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div>
            <label className="flex items-center space-x-3 mb-3">
              <input
                type="checkbox"
                checked={exportOptions.dateRange.enabled}
                onChange={(e) => setExportOptions(prev => ({ 
                  ...prev, 
                  dateRange: { ...prev.dateRange, enabled: e.target.checked }
                }))}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">Filter by Date Range</span>
            </label>
            
            {exportOptions.dateRange.enabled && (
              <div className="grid grid-cols-2 gap-4 ml-7">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={exportOptions.dateRange.start.toISOString().split('T')[0]}
                    onChange={(e) => setExportOptions(prev => ({ 
                      ...prev, 
                      dateRange: { ...prev.dateRange, start: new Date(e.target.value) }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
                  <input
                    type="date"
                    value={exportOptions.dateRange.end.toISOString().split('T')[0]}
                    onChange={(e) => setExportOptions(prev => ({ 
                      ...prev, 
                      dateRange: { ...prev.dateRange, end: new Date(e.target.value) }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Privacy Notice */}
          {exportOptions.includeProfile && exportOptions.includePersonalInfo && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex">
                <SettingsIcon className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-amber-800">Privacy Notice</h4>
                  <p className="text-sm text-amber-700 mt-1">
                    Your export will include personal health information. Please handle the exported file securely.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="btn-primary inline-flex items-center space-x-2"
          >
            {isExporting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                <span>Export Data</span>
              </>
            )}
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
