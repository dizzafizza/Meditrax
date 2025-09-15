import React from 'react';
import { 
  FileText, 
  Download, 
  Calendar, 
  BarChart3,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Pill,
  PlusCircle,
  TrendingUp,
  Database
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMedicationStore } from '@/store';
import { formatDate, generateCSV, downloadFile, generateId } from '@/utils/helpers';
import { AdherenceReport, SideEffectReport } from '@/types';
import toast from 'react-hot-toast';

export function Reports() {
  const {
    medications,
    logs,
    getMissedDoses,
    addMedication,
    logMedication
  } = useMedicationStore();

  const [selectedReport, setSelectedReport] = React.useState<'adherence' | 'side-effects' | 'summary'>('adherence');
  const [dateRange, setDateRange] = React.useState({
    start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago (more inclusive)
    end: new Date()
  });
  const [isLoadingSampleData, setIsLoadingSampleData] = React.useState(false);

  // Function to load sample data for testing and demonstration
  const loadSampleData = async () => {
    setIsLoadingSampleData(true);
    try {
      // Sample medications
      const sampleMedications = [
        {
          name: 'Lisinopril',
          dosage: '10',
          unit: 'mg' as const,
          frequency: 'once-daily' as const,
          category: 'cardiovascular' as const,
          color: '#ef4444',
          isActive: true,
          startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) // 60 days ago
        },
        {
          name: 'Metformin',
          dosage: '500',
          unit: 'mg' as const,
          frequency: 'twice-daily' as const,
          category: 'diabetes' as const,
          color: '#3b82f6',
          isActive: true,
          startDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000) // 45 days ago
        },
        {
          name: 'Vitamin D3',
          dosage: '1000',
          unit: 'IU' as const,
          frequency: 'once-daily' as const,
          category: 'vitamin' as const,
          color: '#f59e0b',
          isActive: true,
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
        }
      ];

      // Add sample medications
      const addedMedications: any[] = [];
      for (const med of sampleMedications) {
        addMedication(med);
        addedMedications.push(med);
      }

      // Wait for state to update and get the medication IDs
      setTimeout(() => {
        // Get the current medications from the store to find the IDs
        const currentMedications = medications.filter(m => 
          addedMedications.some(added => added.name === m.name)
        );

        // Add sample medication logs (simulate realistic adherence patterns)
        for (let i = 0; i < 30; i++) {
          currentMedications.forEach((med, index) => {
            // Simulate different adherence patterns
            const adherenceRate = [0.95, 0.88, 0.92][index] || 0.9; // Different rates for each medication
            
            if (Math.random() < adherenceRate) {
              // Log as taken with occasional simple side effects
              const sideEffects = Math.random() < 0.1 ? 
                ['mild headache', 'nausea', 'dizziness', 'fatigue'][Math.floor(Math.random() * 4)] : 
                undefined;
              
              logMedication(med.id, undefined, undefined, 
                sideEffects ? [sideEffects] : undefined
              );
            }
          });
        }

        // Add some enhanced side effect reports for more detailed data
        setTimeout(() => {
          const updatedMedications = medications.filter(m => 
            addedMedications.some(added => added.name === m.name)
          );

          updatedMedications.forEach((med, index) => {
            // Add 1-3 enhanced side effect reports per medication
            const numReports = Math.floor(Math.random() * 3) + 1;
            const sideEffectOptions = [
              { effect: 'Mild headache', severity: 'mild' as const, bodySystem: 'neurological' as const },
              { effect: 'Nausea', severity: 'mild' as const, bodySystem: 'gastrointestinal' as const },
              { effect: 'Dizziness', severity: 'mild' as const, bodySystem: 'neurological' as const },
              { effect: 'Fatigue', severity: 'mild' as const, bodySystem: 'other' as const },
              { effect: 'Dry mouth', severity: 'mild' as const, bodySystem: 'other' as const },
              { effect: 'Stomach upset', severity: 'moderate' as const, bodySystem: 'gastrointestinal' as const }
            ];

            for (let j = 0; j < numReports; j++) {
              const sideEffect = sideEffectOptions[Math.floor(Math.random() * sideEffectOptions.length)];
              const daysAgo = Math.floor(Math.random() * 20) + 1; // 1-20 days ago
              
              const enhancedReport = {
                id: generateId(),
                medicationId: med.id,
                medicationName: med.name,
                sideEffect: sideEffect.effect,
                severity: sideEffect.severity,
                onset: 'within-hours' as const,
                frequency: ['occasional', 'frequent'][Math.floor(Math.random() * 2)] as const,
                duration: Math.floor(Math.random() * 12) + 1, // 1-12 hours
                interference: ['none', 'mild'][Math.floor(Math.random() * 2)] as const,
                bodySystem: sideEffect.bodySystem,
                description: `${sideEffect.effect} experienced after taking ${med.name}`,
                timestamp: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
                resolved: Math.random() < 0.8, // 80% resolved
                resolvedDate: Math.random() < 0.8 ? new Date(Date.now() - (daysAgo - 1) * 24 * 60 * 60 * 1000) : undefined,
                actionTaken: ['continued', 'reduced-dose'][Math.floor(Math.random() * 2)] as const,
                relatedMedications: [],
                doctorNotified: Math.random() < 0.3, // 30% notified doctor
                reportedDates: [new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)],
                followUpRequired: Math.random() < 0.2 // 20% need follow-up
              };

              // Add the enhanced side effect report to the medication
              const currentReports = med.sideEffectReports || [];
              const { updateMedication } = useMedicationStore.getState();
              updateMedication(med.id, {
                sideEffectReports: [...currentReports, enhancedReport],
                enhancedMonitoring: true
              });
            }
          });
        }, 200);
      }, 100);

      toast.success('Sample data loaded! You can now see reports with realistic medication data.');
    } catch (error) {
      console.error('Failed to load sample data:', error);
      toast.error('Failed to load sample data');
    } finally {
      setIsLoadingSampleData(false);
    }
  };

  // Check if user has any data at all
  const hasAnyData = medications.length > 0 || logs.length > 0;
  const hasLogsInDateRange = logs.some(log => 
    new Date(log.timestamp) >= dateRange.start && 
    new Date(log.timestamp) <= dateRange.end
  );

  // Generate adherence report
  const generateAdherenceReport = (): AdherenceReport[] => {
    return medications.map(medication => {
      const medicationLogs = logs.filter(log => 
        log.medicationId === medication.id &&
        new Date(log.timestamp) >= dateRange.start &&
        new Date(log.timestamp) <= dateRange.end
      );

      const totalDoses = medicationLogs.length;
      const takenDoses = medicationLogs.filter(log => log.adherence === 'taken').length;
      const missedDoses = medicationLogs.filter(log => log.adherence === 'missed').length;

      return {
        medicationId: medication.id,
        medicationName: medication.name,
        totalDoses,
        takenDoses,
        missedDoses,
        adherencePercentage: totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : 0,
        period: {
          start: dateRange.start,
          end: dateRange.end
        }
      };
    }).filter(report => report.totalDoses > 0);
  };

  // Generate side effects report - combines both simple and enhanced side effect data
  const generateSideEffectsReport = (): SideEffectReport[] => {
    const sideEffectsMap = new Map<string, { 
      medication: string; 
      effect: string; 
      dates: Date[]; 
      severity: 'mild' | 'moderate' | 'severe' | 'life-threatening';
      medicationId: string;
    }>();

    // Check simple side effects from medication logs
    logs.forEach(log => {
      const medication = medications.find(med => med.id === log.medicationId);
      if (!medication || !log.sideEffectsReported) return;

      // Filter logs within date range
      const logDate = new Date(log.timestamp);
      if (logDate < dateRange.start || logDate > dateRange.end) return;

      log.sideEffectsReported.forEach(effect => {
        const key = `${medication.name}-${effect}`;
        if (!sideEffectsMap.has(key)) {
          sideEffectsMap.set(key, {
            medication: medication.name,
            medicationId: medication.id,
            effect,
            dates: [],
            severity: 'mild' // Default severity for simple reports
          });
        }
        sideEffectsMap.get(key)!.dates.push(new Date(log.timestamp));
      });
    });

    // Check enhanced side effect reports from medications
    medications.forEach(medication => {
      if (!medication.sideEffectReports) return;

      medication.sideEffectReports.forEach(report => {
        // Filter reports within date range
        const reportDate = new Date(report.timestamp);
        if (reportDate < dateRange.start || reportDate > dateRange.end) return;

        const key = `${medication.name}-${report.sideEffect}`;
        if (!sideEffectsMap.has(key)) {
          sideEffectsMap.set(key, {
            medication: medication.name,
            medicationId: medication.id,
            effect: report.sideEffect,
            dates: [],
            severity: report.severity
          });
        }
        
        const existing = sideEffectsMap.get(key)!;
        existing.dates.push(new Date(report.timestamp));
        
        // Use the most severe severity if there are multiple reports
        const severityLevels = { 'mild': 1, 'moderate': 2, 'severe': 3, 'life-threatening': 4 };
        if (severityLevels[report.severity] > severityLevels[existing.severity]) {
          existing.severity = report.severity;
        }
      });
    });

    return Array.from(sideEffectsMap.entries()).map(([, data]) => ({
      medicationId: data.medicationId,
      medicationName: data.medication,
      sideEffect: data.effect,
      frequency: data.dates.length,
      severity: data.severity,
      reportedDates: data.dates.sort((a, b) => a.getTime() - b.getTime()) // Sort dates chronologically
    }));
  };

  const adherenceReports = generateAdherenceReport();
  const sideEffectsReports = generateSideEffectsReport();

  // Summary statistics
  const totalMedications = medications.filter(med => med.isActive).length;
  const overallAdherence = adherenceReports.length > 0 
    ? Math.round(adherenceReports.reduce((sum, report) => sum + report.adherencePercentage, 0) / adherenceReports.length)
    : 0;
  const missedDosesCount = getMissedDoses(30).length;
  const totalSideEffects = sideEffectsReports.reduce((sum, report) => sum + report.frequency, 0);

  const handleExportAdherenceCSV = () => {
    if (adherenceReports.length === 0) {
      toast.error('No adherence data available for the selected period');
      return;
    }

    const csvData = generateCSV(adherenceReports.map(report => ({
      medication: report.medicationName,
      total_doses: report.totalDoses,
      taken_doses: report.takenDoses,
      missed_doses: report.missedDoses,
      adherence_percentage: report.adherencePercentage,
      period_start: formatDate(report.period.start),
      period_end: formatDate(report.period.end)
    })));

    downloadFile(
      csvData,
      `adherence-report-${formatDate(new Date(), 'yyyy-MM-dd')}.csv`,
      'text/csv'
    );
    toast.success('Adherence report exported successfully');
  };

  const handleExportSideEffectsCSV = () => {
    if (sideEffectsReports.length === 0) {
      toast.error('No side effects data available');
      return;
    }

    const csvData = generateCSV(sideEffectsReports.map(report => ({
      medication: report.medicationName,
      side_effect: report.sideEffect,
      severity: report.severity,
      frequency: report.frequency,
      first_reported: formatDate(report.reportedDates[0]),
      last_reported: formatDate(report.reportedDates[report.reportedDates.length - 1]),
      total_occurrences: report.reportedDates.length
    })));

    downloadFile(
      csvData,
      `side-effects-report-${formatDate(new Date(), 'yyyy-MM-dd')}.csv`,
      'text/csv'
    );
    toast.success('Side effects report exported successfully');
  };

  const handleExportSummaryPDF = () => {
    // For now, export as JSON - PDF generation would require additional library
    const summaryData = {
      generatedDate: new Date(),
      dateRange,
      summary: {
        totalMedications,
        overallAdherence,
        missedDoses: missedDosesCount,
        totalSideEffects
      },
      adherenceData: adherenceReports,
      sideEffectsData: sideEffectsReports
    };

    downloadFile(
      JSON.stringify(summaryData, null, 2),
      `summary-report-${formatDate(new Date(), 'yyyy-MM-dd')}.json`,
      'application/json'
    );
    toast.success('Summary report exported as JSON');
  };

  const ReportTab = ({ name, icon: Icon, isActive, onClick }: {
    name: string;
    icon: any;
    isActive: boolean;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
        isActive
          ? 'bg-blue-100 text-blue-700 border border-blue-200'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      <Icon className="h-4 w-4" />
      <span>{name}</span>
    </button>
  );

  // Show empty state if no data exists
  if (!hasAnyData) {
    return (
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
            <p className="mt-1 text-sm text-gray-500">
              Generate and export detailed medication reports
            </p>
          </div>
        </div>

        {/* No Data State */}
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <div className="text-center">
            <BarChart3 className="mx-auto h-16 w-16 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No Medication Data Yet</h3>
            <p className="mt-2 text-gray-500 max-w-md mx-auto">
              To generate reports, you need to add medications and start logging your doses. 
              Reports will show your adherence patterns, side effects, and medication trends.
            </p>
            
            <div className="mt-8 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                <Link
                  to="/medications"
                  className="flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                >
                  <PlusCircle className="h-5 w-5 mr-2" />
                  Add Your First Medication
                </Link>
                
                <button
                  onClick={loadSampleData}
                  disabled={isLoadingSampleData}
                  className="flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <Database className="h-5 w-5 mr-2" />
                  {isLoadingSampleData ? 'Loading...' : 'Load Sample Data'}
                </button>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-2xl mx-auto">
                <div className="flex items-start space-x-3">
                  <TrendingUp className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium">Reports will include:</p>
                    <ul className="mt-1 list-disc list-inside space-y-1">
                      <li>Medication adherence percentages</li>
                      <li>Side effects tracking and frequency</li>
                      <li>Missed doses and patterns</li>
                      <li>Exportable data for healthcare providers</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="mt-1 text-sm text-gray-500">
            Generate and export detailed medication reports
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center space-x-3">
          <input
            type="date"
            value={dateRange.start.toISOString().split('T')[0]}
            onChange={(e) => setDateRange(prev => ({ ...prev, start: new Date(e.target.value) }))}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
          <span className="text-gray-500">to</span>
          <input
            type="date"
            value={dateRange.end.toISOString().split('T')[0]}
            onChange={(e) => setDateRange(prev => ({ ...prev, end: new Date(e.target.value) }))}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
          <button
            onClick={loadSampleData}
            disabled={isLoadingSampleData}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
            title="Add sample data for testing"
          >
            <Database className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <div className="card-content p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="bg-blue-500 rounded-md p-3">
                  <Pill className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Active Medications
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {totalMedications}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-content p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="bg-green-500 rounded-md p-3">
                  <CheckCircle className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Overall Adherence
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {overallAdherence}%
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-content p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="bg-red-500 rounded-md p-3">
                  <XCircle className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Missed Doses (30d)
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {missedDosesCount}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-content p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="bg-orange-500 rounded-md p-3">
                  <AlertTriangle className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Side Effects
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {totalSideEffects}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Report Tabs */}
      <div className="flex space-x-2">
        <ReportTab
          name="Adherence"
          icon={BarChart3}
          isActive={selectedReport === 'adherence'}
          onClick={() => setSelectedReport('adherence')}
        />
        <ReportTab
          name="Side Effects"
          icon={AlertTriangle}
          isActive={selectedReport === 'side-effects'}
          onClick={() => setSelectedReport('side-effects')}
        />
        <ReportTab
          name="Summary"
          icon={FileText}
          isActive={selectedReport === 'summary'}
          onClick={() => setSelectedReport('summary')}
        />
      </div>

      {/* Report Content */}
      <div className="card">
        <div className="card-content">
          {selectedReport === 'adherence' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900">Adherence Report</h3>
                <button
                  onClick={handleExportAdherenceCSV}
                  className="btn-secondary inline-flex items-center space-x-2"
                >
                  <Download className="h-4 w-4" />
                  <span>Export CSV</span>
                </button>
              </div>

              {adherenceReports.length === 0 ? (
                <div className="text-center py-8">
                  <BarChart3 className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No adherence data available</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {!hasLogsInDateRange 
                      ? 'No medication logs found for the selected date range. Try expanding the date range or start logging your medications.'
                      : 'No medication logs found for the selected date range.'
                    }
                  </p>
                  {!hasLogsInDateRange && (
                    <div className="mt-4 space-y-2">
                      <Link
                        to="/dashboard"
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                      >
                        <PlusCircle className="h-4 w-4 mr-2" />
                        Start Logging Medications
                      </Link>
                      <p className="text-xs text-gray-400 mt-2">
                        or <button 
                          onClick={() => setDateRange({ 
                            start: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), 
                            end: new Date() 
                          })}
                          className="text-blue-500 hover:text-blue-700 underline"
                        >expand to show all-time data</button>
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Medication
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Doses
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Taken
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Missed
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Adherence
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {adherenceReports.map((report) => (
                        <tr key={report.medicationId}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {report.medicationName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {report.totalDoses}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                            {report.takenDoses}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                            {report.missedDoses}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              report.adherencePercentage >= 90 
                                ? 'bg-green-100 text-green-800'
                                : report.adherencePercentage >= 75
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {report.adherencePercentage}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {selectedReport === 'side-effects' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900">Side Effects Report</h3>
                <button
                  onClick={handleExportSideEffectsCSV}
                  className="btn-secondary inline-flex items-center space-x-2"
                >
                  <Download className="h-4 w-4" />
                  <span>Export CSV</span>
                </button>
              </div>

              {sideEffectsReports.length === 0 ? (
                <div className="text-center py-8">
                  <AlertTriangle className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No side effects reported</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {hasLogsInDateRange 
                      ? 'No side effects have been logged for your medications in this date range. This is good news!'
                      : 'No side effects data available. Start logging medications to track any side effects.'
                    }
                  </p>
                  {!hasLogsInDateRange && (
                    <div className="mt-4">
                      <Link
                        to="/dashboard"
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                      >
                        <PlusCircle className="h-4 w-4 mr-2" />
                        Start Tracking Side Effects
                      </Link>
                    </div>
                  )}
                </div>
              ) : (
                <div className="overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Medication
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Side Effect
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Severity
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Frequency
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          First Reported
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Last Reported
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {sideEffectsReports.map((report, index) => {
                        const getSeverityBadge = (severity: string) => {
                          const severityColors = {
                            'mild': 'bg-green-100 text-green-800',
                            'moderate': 'bg-yellow-100 text-yellow-800',
                            'severe': 'bg-red-100 text-red-800',
                            'life-threatening': 'bg-purple-100 text-purple-800'
                          };
                          return (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${severityColors[severity] || 'bg-gray-100 text-gray-800'}`}>
                              {severity.charAt(0).toUpperCase() + severity.slice(1)}
                            </span>
                          );
                        };

                        return (
                          <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {report.medicationName}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {report.sideEffect}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              {getSeverityBadge(report.severity)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {report.frequency} time{report.frequency !== 1 ? 's' : ''}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDate(report.reportedDates[0])}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDate(report.reportedDates[report.reportedDates.length - 1])}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {selectedReport === 'summary' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900">Summary Report</h3>
                <button
                  onClick={handleExportSummaryPDF}
                  className="btn-secondary inline-flex items-center space-x-2"
                >
                  <Download className="h-4 w-4" />
                  <span>Export Summary</span>
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-4">Report Period</h4>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDate(dateRange.start)} - {formatDate(dateRange.end)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-4">Key Insights</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Best Adherence:</span>
                      <span className="font-medium">
                        {adherenceReports.length > 0 
                          ? adherenceReports.reduce((best, current) => 
                              current.adherencePercentage > best.adherencePercentage ? current : best
                            ).medicationName
                          : 'N/A'
                        }
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Most Common Side Effect:</span>
                      <span className="font-medium">
                        {sideEffectsReports.length > 0 
                          ? sideEffectsReports.reduce((common, current) =>
                              current.frequency > common.frequency ? current : common
                            ).sideEffect
                          : 'None reported'
                        }
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
