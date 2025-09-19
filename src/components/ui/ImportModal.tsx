import React from 'react';
import { 
  X, 
  Upload, 
  AlertTriangle, 
  CheckCircle, 
  FileText,
  AlertCircle,
  Loader
} from 'lucide-react';
import { useMedicationStore } from '@/store';
import toast from 'react-hot-toast';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const { importDataWithValidation, validateImportData } = useMedicationStore();

  const [file, setFile] = React.useState<File | null>(null);
  const [importData, setImportData] = React.useState<any>(null);
  const [validation, setValidation] = React.useState<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } | null>(null);
  const [isImporting, setIsImporting] = React.useState(false);
  const [isValidating, setIsValidating] = React.useState(false);
  const [importResult, setImportResult] = React.useState<{
    success: boolean;
    errors: string[];
    warnings: string[];
  } | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setImportData(null);
    setValidation(null);
    setImportResult(null);

    if (!selectedFile.name.endsWith('.json')) {
      setValidation({
        isValid: false,
        errors: ['Only JSON files are supported for import'],
        warnings: []
      });
      return;
    }

    setIsValidating(true);
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const jsonData = JSON.parse(e.target?.result as string);
        setImportData(jsonData);
        
        // Validate the data
        const validationResult = validateImportData(jsonData);
        setValidation(validationResult);
      } catch (error) {
        setValidation({
          isValid: false,
          errors: ['Invalid JSON file format'],
          warnings: []
        });
      } finally {
        setIsValidating(false);
      }
    };

    reader.onerror = () => {
      setValidation({
        isValid: false,
        errors: ['Failed to read file'],
        warnings: []
      });
      setIsValidating(false);
    };

    reader.readAsText(selectedFile);
  };

  const handleImport = async () => {
    if (!importData || !validation?.isValid) return;

    setIsImporting(true);
    try {
      const result = await importDataWithValidation(importData, 'json');
      setImportResult(result);
      
      if (result.success) {
        toast.success('Data imported successfully');
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        toast.error('Import failed with errors');
      }
    } catch (error) {
      setImportResult({
        success: false,
        errors: ['Unexpected error during import'],
        warnings: []
      });
      toast.error('Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setImportData(null);
    setValidation(null);
    setImportResult(null);
    setIsImporting(false);
    setIsValidating(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const getDataSummary = () => {
    if (!importData) return null;

    const summary = {
      medications: importData.medications?.length || 0,
      logs: importData.logs?.length || 0,
      reminders: importData.reminders?.length || 0,
      hasProfile: !!importData.userProfile,
      version: importData.exportMetadata?.version || 'Unknown'
    };

    return summary;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 glass-overlay flex items-center justify-center p-4 z-[60] mobile-safe-area">
      <div className="glass-panel rounded-lg max-w-2xl w-full mobile-modal overflow-y-auto mobile-scroll">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Upload className="h-6 w-6 text-blue-600" />
            <h3 className="text-lg font-medium text-gray-900">Import Data</h3>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* File Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select Data File
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
                id="import-file"
              />
              <label
                htmlFor="import-file"
                className="cursor-pointer flex flex-col items-center space-y-2"
              >
                <FileText className="h-8 w-8 text-gray-400" />
                <span className="text-sm text-gray-600">
                  {file ? file.name : 'Click to select a JSON file'}
                </span>
                <span className="text-xs text-gray-500">
                  Only Meditrax JSON export files are supported
                </span>
              </label>
            </div>
          </div>

          {/* Validation Status */}
          {isValidating && (
            <div className="flex items-center space-x-3 p-4 bg-blue-50 rounded-lg">
              <Loader className="h-5 w-5 text-blue-600 animate-spin" />
              <span className="text-sm text-blue-800">Validating file...</span>
            </div>
          )}

          {/* Validation Results */}
          {validation && !isValidating && (
            <div className={`p-4 rounded-lg ${
              validation.isValid ? 'bg-green-50' : 'bg-red-50'
            }`}>
              <div className="flex items-start space-x-3">
                {validation.isValid ? (
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <h4 className={`text-sm font-medium ${
                    validation.isValid ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {validation.isValid ? 'File is valid and ready to import' : 'File validation failed'}
                  </h4>
                  
                  {validation.errors.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm text-red-700 font-medium">Errors:</p>
                      <ul className="text-sm text-red-600 list-disc list-inside mt-1">
                        {validation.errors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {validation.warnings.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm text-amber-700 font-medium">Warnings:</p>
                      <ul className="text-sm text-amber-600 list-disc list-inside mt-1">
                        {validation.warnings.map((warning, index) => (
                          <li key={index}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Data Summary */}
          {validation?.isValid && !isValidating && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Import Summary</h4>
              {(() => {
                const summary = getDataSummary();
                if (!summary) return null;
                
                return (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Medications:</span>
                        <span className="font-medium">{summary.medications}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Medication Logs:</span>
                        <span className="font-medium">{summary.logs}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Reminders:</span>
                        <span className="font-medium">{summary.reminders}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Health Profile:</span>
                        <span className="font-medium">{summary.hasProfile ? 'Yes' : 'No'}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Import Result */}
          {importResult && (
            <div className={`p-4 rounded-lg ${
              importResult.success ? 'bg-green-50' : 'bg-red-50'
            }`}>
              <div className="flex items-start space-x-3">
                {importResult.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <h4 className={`text-sm font-medium ${
                    importResult.success ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {importResult.success ? 'Data imported successfully!' : 'Import failed'}
                  </h4>
                  
                  {importResult.errors.length > 0 && (
                    <div className="mt-2">
                      <ul className="text-sm text-red-600 list-disc list-inside">
                        {importResult.errors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {importResult.warnings.length > 0 && (
                    <div className="mt-2">
                      <ul className="text-sm text-amber-600 list-disc list-inside">
                        {importResult.warnings.map((warning, index) => (
                          <li key={index}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Important Notice */}
          {!importResult && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex">
                <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-amber-800">Important</h4>
                  <p className="text-sm text-amber-700 mt-1">
                    Importing data will add to your existing records. A backup of your current data will be created automatically before import.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleClose}
            className="btn-secondary"
          >
            {importResult?.success ? 'Close' : 'Cancel'}
          </button>
          {!importResult && (
            <button
              onClick={handleImport}
              disabled={!validation?.isValid || isImporting}
              className="btn-primary inline-flex items-center space-x-2"
            >
              {isImporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  <span>Import Data</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}



