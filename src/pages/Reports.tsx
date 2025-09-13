import React from 'react';
import { 
  FileText, 
  Download, 
  Calendar, 
  BarChart3,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Pill
} from 'lucide-react';
import { useMedicationStore } from '@/store';
import { formatDate, generateCSV, downloadFile } from '@/utils/helpers';
import { AdherenceReport, SideEffectReport } from '@/types';
import toast from 'react-hot-toast';

export function Reports() {
  const {
    medications,
    logs,
    getMissedDoses
  } = useMedicationStore();

  const [selectedReport, setSelectedReport] = React.useState<'adherence' | 'side-effects' | 'summary'>('adherence');
  const [dateRange, setDateRange] = React.useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    end: new Date()
  });

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

  // Generate side effects report
  const generateSideEffectsReport = (): SideEffectReport[] => {
    const sideEffectsMap = new Map<string, { medication: string; effect: string; dates: Date[] }>();

    logs.forEach(log => {
      const medication = medications.find(med => med.id === log.medicationId);
      if (!medication || !log.sideEffectsReported) return;

      log.sideEffectsReported.forEach(effect => {
        const key = `${medication.name}-${effect}`;
        if (!sideEffectsMap.has(key)) {
          sideEffectsMap.set(key, {
            medication: medication.name,
            effect,
            dates: []
          });
        }
        sideEffectsMap.get(key)!.dates.push(new Date(log.timestamp));
      });
    });

    return Array.from(sideEffectsMap.entries()).map(([, data]) => ({
      medicationId: medications.find(med => med.name === data.medication)?.id || '',
      medicationName: data.medication,
      sideEffect: data.effect,
      frequency: data.dates.length,
      severity: 'mild' as const, // Would need more data to determine actual severity
      reportedDates: data.dates
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
      frequency: report.frequency,
      severity: report.severity,
      first_reported: formatDate(report.reportedDates[0]),
      last_reported: formatDate(report.reportedDates[report.reportedDates.length - 1])
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
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No data available</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    No medication logs found for the selected date range.
                  </p>
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
                    No side effects have been logged for your medications.
                  </p>
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
                      {sideEffectsReports.map((report, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {report.medicationName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {report.sideEffect}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {report.frequency}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(report.reportedDates[0])}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(report.reportedDates[report.reportedDates.length - 1])}
                          </td>
                        </tr>
                      ))}
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
