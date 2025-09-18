import React from 'react';
import { X, AlertTriangle, CheckCircle, XCircle, Info, Smartphone, Wifi, Bell } from 'lucide-react';
import { notificationService } from '@/services/notificationService';
import toast from 'react-hot-toast';

interface NotificationDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationDiagnosticModal({ isOpen, onClose }: NotificationDiagnosticModalProps) {
  const [diagnostic, setDiagnostic] = React.useState<any>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const runDiagnostic = async () => {
    setIsLoading(true);
    try {
      const result = await notificationService.diagnoseIOSPWANotificationIssues();
      setDiagnostic(result);
    } catch (error) {
      console.error('Failed to run diagnostic:', error);
      toast.error('Failed to run diagnostic');
    } finally {
      setIsLoading(false);
    }
  };

  const runMissedDoseRecovery = async () => {
    try {
      await notificationService.implementMissedDoseRecovery();
      toast.success('Missed dose recovery completed');
    } catch (error) {
      console.error('Failed to run missed dose recovery:', error);
      toast.error('Failed to run missed dose recovery');
    }
  };

  React.useEffect(() => {
    if (isOpen) {
      runDiagnostic();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Bell className="h-6 w-6" />
            Notification Diagnostic
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3">Running diagnostic...</span>
            </div>
          )}

          {diagnostic && (
            <>
              {/* Core Issue Alert */}
              <div className={`p-4 rounded-lg border-l-4 ${
                diagnostic.coreIssue.includes('iOS Safari') 
                  ? 'bg-amber-50 border-amber-400' 
                  : 'bg-green-50 border-green-400'
              }`}>
                <div className="flex items-start">
                  {diagnostic.coreIssue.includes('iOS Safari') ? (
                    <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 mr-3 flex-shrink-0" />
                  ) : (
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                  )}
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Core Issue Identified</h3>
                    <p className="text-gray-700">{diagnostic.coreIssue}</p>
                  </div>
                </div>
              </div>

              {/* System Status */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Wifi className="h-5 w-5 text-gray-600" />
                    <h4 className="font-medium">Service Worker</h4>
                  </div>
                  <p className={`text-sm ${
                    diagnostic.serviceWorkerStatus === 'active' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {diagnostic.serviceWorkerStatus}
                  </p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Smartphone className="h-5 w-5 text-gray-600" />
                    <h4 className="font-medium">Background Execution</h4>
                  </div>
                  <p className={`text-sm ${
                    diagnostic.backgroundExecution === 'responsive' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {diagnostic.backgroundExecution}
                  </p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Bell className="h-5 w-5 text-gray-600" />
                    <h4 className="font-medium">Notification Status</h4>
                  </div>
                  {diagnostic.notificationTracking.map((item: any, index: number) => (
                    <p key={index} className="text-sm text-gray-600">
                      {Object.entries(item).map(([key, value]) => (
                        <span key={key}>{key}: {String(value)}</span>
                      ))}
                    </p>
                  ))}
                </div>
              </div>

              {/* Recommendations */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Info className="h-5 w-5 text-blue-500" />
                  Recommendations
                </h4>
                <ul className="space-y-2">
                  {diagnostic.recommendations.map((rec: string, index: number) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-blue-500 mt-1">•</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Alternative Solutions */}
              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Alternative Solutions
                </h4>
                <ul className="space-y-2">
                  {diagnostic.alternativeSolutions.map((solution: string, index: number) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-green-500 mt-1">•</span>
                      {solution}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={runDiagnostic}
                  disabled={isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex-1"
                >
                  Re-run Diagnostic
                </button>
                
                {diagnostic.coreIssue.includes('iOS Safari') && (
                  <button
                    onClick={runMissedDoseRecovery}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 flex-1"
                  >
                    Run Missed Dose Recovery
                  </button>
                )}
                
                <button
                  onClick={() => {
                    notificationService.debugTestNotification();
                    toast.success('Test notification sent');
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex-1"
                >
                  Test Notification
                </button>
              </div>

              {/* iOS PWA Specific Help */}
              {diagnostic.coreIssue.includes('iOS Safari') && (
                <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                  <h4 className="font-semibold text-gray-900 mb-2">🍎 iOS PWA Users - Important Information</h4>
                  <div className="text-sm text-gray-700 space-y-2">
                    <p><strong>Why background notifications don't work:</strong> iOS Safari limits background execution for PWAs to conserve battery and protect privacy.</p>
                    <p><strong>What we're doing:</strong> When you open the app, we check for missed doses and show recovery notifications.</p>
                    <p><strong>Recommendations:</strong></p>
                    <ul className="ml-4 mt-2 space-y-1">
                      <li>• Keep the app open when possible</li>
                      <li>• Check the app regularly for missed dose notifications</li>
                      <li>• Use iOS Calendar/Reminders as backup</li>
                      <li>• Consider the native iOS app for reliable background notifications</li>
                    </ul>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="border-t p-6">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
