import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  Clock,
  BarChart3,
  Download,
  RefreshCw,
  Activity,
  AlertTriangle,
  Shield,
  Heart
} from 'lucide-react';
import { useMedicationStore } from '@/store';
import { getAdherenceColor, calculateAdherence } from '@/utils/helpers';
import { AdherenceReport } from '@/types';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { ChartErrorBoundary } from '@/components/ui/ErrorBoundary';
import { ExportModal } from '@/components/ui/ExportModal';
import { subDays, format, eachDayOfInterval, isSameDay } from 'date-fns';

export function Analytics() {
  const {
    medications,
    logs,
  } = useMedicationStore();

  const [dateRange, setDateRange] = React.useState<'7d' | '30d' | '90d'>('30d');
  const [selectedMedication, setSelectedMedication] = React.useState<string | 'all'>('all');
  const [activeTab, setActiveTab] = React.useState<'adherence' | 'withdrawal' | 'side-effects' | 'risk'>('adherence');

  const activeMedications = medications.filter(med => med.isActive);
  const allMedications = medications; // Include inactive medications for log analysis

  // Calculate adherence data
  const adherenceData = React.useMemo(() => {
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
    const endDate = new Date();
    const startDate = subDays(endDate, days - 1);
    
    return eachDayOfInterval({ start: startDate, end: endDate }).map(date => {
      const dayLogs = logs.filter(log => {
        try {
          const logDate = new Date(log.timestamp);
          return logDate instanceof Date && !isNaN(logDate.getTime()) && isSameDay(logDate, date);
        } catch {
          return false;
        }
      });
      
      const takenCount = dayLogs.filter(log => log.adherence === 'taken').length;
      const missedCount = dayLogs.filter(log => log.adherence === 'missed').length;
      const totalCount = takenCount + missedCount;
      
      const adherencePercent = totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 0;
      
      // Ensure all values are valid numbers and within expected ranges
      const safeAdherence = Number.isFinite(adherencePercent) && adherencePercent >= 0 && adherencePercent <= 100 ? adherencePercent : 0;
      const safeTaken = Number.isFinite(takenCount) && takenCount >= 0 ? takenCount : 0;
      const safeMissed = Number.isFinite(missedCount) && missedCount >= 0 ? missedCount : 0;
      
      return {
        date: format(date, 'MMM dd'),
        fullDate: date,
        taken: safeTaken,
        missed: safeMissed,
        adherence: safeAdherence,
      };
    });
  }, [logs, dateRange]);

  // Calculate medication-specific adherence
  const medicationAdherence: AdherenceReport[] = React.useMemo(() => {
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
    
    // Include all medications with logs, not just active ones
    const medicationsWithLogs = allMedications.filter(medication => 
      logs.some(log => log.medicationId === medication.id)
    );
    
    return medicationsWithLogs.map(medication => {
      const medicationLogs = logs.filter(log => {
        try {
          const logDate = new Date(log.timestamp);
          return log.medicationId === medication.id &&
                 logDate instanceof Date && 
                 !isNaN(logDate.getTime()) &&
                 logDate >= subDays(new Date(), days);
        } catch {
          return false;
        }
      });
      
      const takenDoses = medicationLogs.filter(log => log.adherence === 'taken').length;
      const totalDoses = medicationLogs.length;
      const missedDoses = Math.max(0, totalDoses - takenDoses);
      const adherencePercentage = calculateAdherence(takenDoses, totalDoses);
      
      // Ensure all values are valid numbers
      const safeTotalDoses = Number.isFinite(totalDoses) ? totalDoses : 0;
      const safeTakenDoses = Number.isFinite(takenDoses) ? takenDoses : 0;
      const safeMissedDoses = Number.isFinite(missedDoses) ? missedDoses : 0;
      const safeAdherencePercentage = Number.isFinite(adherencePercentage) ? adherencePercentage : 0;
      
      return {
        medicationId: medication.id,
        medicationName: medication.name,
        totalDoses: safeTotalDoses,
        takenDoses: safeTakenDoses,
        missedDoses: safeMissedDoses,
        adherencePercentage: safeAdherencePercentage,
        period: {
          start: subDays(new Date(), days),
          end: new Date(),
        },
      };
    }).sort((a, b) => (b.adherencePercentage || 0) - (a.adherencePercentage || 0));
  }, [activeMedications, logs, dateRange]);

  // Calculate overall stats
  const overallStats = React.useMemo(() => {
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
    const recentLogs = logs.filter(log => {
      try {
        const logDate = new Date(log.timestamp);
        return logDate instanceof Date && 
               !isNaN(logDate.getTime()) &&
               logDate >= subDays(new Date(), days);
      } catch {
        return false;
      }
    });
    
    const takenCount = recentLogs.filter(log => log.adherence === 'taken').length;
    const missedCount = recentLogs.filter(log => log.adherence === 'missed').length;
    const totalCount = takenCount + missedCount;
    
    const overallAdherence = calculateAdherence(takenCount, totalCount);
    const avgDailyMeds = days > 0 ? Math.round(totalCount / days * 10) / 10 : 0;
    
    // Calculate trend (compare with previous period)
    const previousPeriodLogs = logs.filter(log => {
      try {
        const logDate = new Date(log.timestamp);
        const startPrevious = subDays(new Date(), days * 2);
        const endPrevious = subDays(new Date(), days);
        return logDate instanceof Date && 
               !isNaN(logDate.getTime()) &&
               logDate >= startPrevious && 
               logDate < endPrevious;
      } catch {
        return false;
      }
    });
    const previousTaken = previousPeriodLogs.filter(log => log.adherence === 'taken').length;
    const previousTotal = previousPeriodLogs.length;
    const previousAdherence = calculateAdherence(previousTaken, previousTotal);
    const trend = overallAdherence - previousAdherence;
    
    // Ensure all values are valid numbers
    const safeOverallAdherence = Number.isFinite(overallAdherence) ? overallAdherence : 0;
    const safeTotalCount = Number.isFinite(totalCount) ? totalCount : 0;
    const safeTakenCount = Number.isFinite(takenCount) ? takenCount : 0;
    const safeMissedCount = Number.isFinite(missedCount) ? missedCount : 0;
    const safeAvgDailyMeds = Number.isFinite(avgDailyMeds) ? avgDailyMeds : 0;
    const safeTrend = Number.isFinite(trend) ? trend : 0;
    
    return {
      overallAdherence: safeOverallAdherence,
      totalDoses: safeTotalCount,
      takenDoses: safeTakenCount,
      missedDoses: safeMissedCount,
      avgDailyMeds: safeAvgDailyMeds,
      trend: safeTrend,
    };
  }, [logs, dateRange]);

  // Prepare chart data for adherence by medication
  const medicationChartData = medicationAdherence.slice(0, 10).map(report => {
    // Ensure all values are valid numbers for chart
    const safeAdherence = Number.isFinite(report.adherencePercentage) && !isNaN(report.adherencePercentage) ? report.adherencePercentage : 0;
    const safeTaken = Number.isFinite(report.takenDoses) && !isNaN(report.takenDoses) ? report.takenDoses : 0;
    const safeMissed = Number.isFinite(report.missedDoses) && !isNaN(report.missedDoses) ? report.missedDoses : 0;
    
    return {
      name: report.medicationName && report.medicationName.length > 15 
        ? report.medicationName.substring(0, 15) + '...' 
        : report.medicationName || 'Unknown',
      adherence: Math.max(0, Math.min(100, safeAdherence)), // Clamp between 0-100
      taken: Math.max(0, safeTaken),
      missed: Math.max(0, safeMissed),
    };
  }).filter(item => item.name && item.name !== 'Unknown'); // Filter out invalid entries

  // Prepare pie chart data for adherence distribution
  const adherenceDistribution = [
    { 
      name: 'Taken', 
      value: Number.isFinite(overallStats.takenDoses) && !isNaN(overallStats.takenDoses) ? Math.max(0, overallStats.takenDoses) : 0, 
      color: '#10b981' 
    },
    { 
      name: 'Missed', 
      value: Number.isFinite(overallStats.missedDoses) && !isNaN(overallStats.missedDoses) ? Math.max(0, overallStats.missedDoses) : 0, 
      color: '#ef4444' 
    },
  ].filter(item => Number.isFinite(item.value) && item.value > 0);

  // Calculate withdrawal progress data
  const withdrawalProgressData = React.useMemo(() => {
    const medicationsWithWithdrawal = medications.filter(med => 
      med.dependencePrevention?.withdrawalHistory && med.dependencePrevention.withdrawalHistory.length > 0
    );

    return medicationsWithWithdrawal.map(medication => {
      const withdrawalHistory = medication.dependencePrevention!.withdrawalHistory;
      const activeWithdrawals = withdrawalHistory.filter(event => !event.successfullyCompleted);
      const completedWithdrawals = withdrawalHistory.filter(event => event.successfullyCompleted);
      
      // Calculate current withdrawal progress
      let currentProgress = null;
      if (activeWithdrawals.length > 0) {
        const currentEvent = activeWithdrawals[activeWithdrawals.length - 1];
        const daysSinceStart = Math.floor((new Date().getTime() - new Date(currentEvent.startDate).getTime()) / (1000 * 60 * 60 * 24));
        const resolvedSymptoms = currentEvent.symptoms.filter(s => s.resolved).length;
        const totalSymptoms = currentEvent.symptoms.length;
        const progressPercent = totalSymptoms > 0 ? Math.round((resolvedSymptoms / totalSymptoms) * 100) : 0;
        
        currentProgress = {
          daysSinceStart,
          progressPercent,
          severity: currentEvent.severity,
          symptomCount: totalSymptoms,
          resolvedCount: resolvedSymptoms
        };
      }

      return {
        medicationName: medication.name,
        medicationId: medication.id,
        activeWithdrawals: activeWithdrawals.length,
        completedWithdrawals: completedWithdrawals.length,
        currentProgress,
        totalEvents: withdrawalHistory.length
      };
    });
  }, [medications]);

  // Calculate side effect trends data
  const sideEffectTrendsData = React.useMemo(() => {
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
    const endDate = new Date();
    const startDate = subDays(endDate, days - 1);

    // Get all side effect reports within date range
    const allSideEffects = medications.flatMap(medication => 
      (medication.sideEffectReports || []).filter(report => {
        const reportDate = new Date(report.timestamp);
        return reportDate >= startDate && reportDate <= endDate;
      }).map(report => ({
        ...report,
        medicationName: medication.name,
        medicationId: medication.id
      }))
    );

    // Group by severity
    const severityGroups = allSideEffects.reduce((acc, report) => {
      acc[report.severity] = (acc[report.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Group by body system
    const bodySystemGroups = allSideEffects.reduce((acc, report) => {
      acc[report.bodySystem] = (acc[report.bodySystem] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Daily side effect counts
    const dailySideEffects = eachDayOfInterval({ start: startDate, end: endDate }).map(date => {
      const dayReports = allSideEffects.filter(report => 
        isSameDay(new Date(report.timestamp), date)
      );
      
      return {
        date: format(date, 'MMM dd'),
        fullDate: date,
        total: dayReports.length,
        mild: dayReports.filter(r => r.severity === 'mild').length,
        moderate: dayReports.filter(r => r.severity === 'moderate').length,
        severe: dayReports.filter(r => r.severity === 'severe').length,
        lifeThreatening: dayReports.filter(r => r.severity === 'life-threatening').length
      };
    });

    // Most common side effects
    const commonSideEffects = allSideEffects.reduce((acc, report) => {
      acc[report.sideEffect] = (acc[report.sideEffect] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topSideEffects = Object.entries(commonSideEffects)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    return {
      totalReports: allSideEffects.length,
      severityDistribution: Object.entries(severityGroups).map(([severity, count]) => ({
        severity,
        count,
        percentage: Math.round((count / allSideEffects.length) * 100)
      })),
      bodySystemDistribution: Object.entries(bodySystemGroups).map(([system, count]) => ({
        system,
        count,
        percentage: Math.round((count / allSideEffects.length) * 100)
      })),
      dailyTrends: dailySideEffects,
      topSideEffects,
      recentReports: allSideEffects.slice(-5).reverse()
    };
  }, [medications, dateRange]);

  // Calculate dependency risk analytics
  const dependencyRiskData = React.useMemo(() => {
    const riskDistribution = medications.reduce((acc, medication) => {
      if (medication.isActive) {
        acc[medication.riskLevel] = (acc[medication.riskLevel] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const medicationsWithPrevention = medications.filter(med => 
      med.dependencePrevention && med.isActive
    );

    const alertCounts = medicationsWithPrevention.reduce((acc, medication) => {
      const alerts = medication.dependencePrevention?.alerts || [];
      const unacknowledged = alerts.filter(alert => !alert.acknowledged).length;
      const total = alerts.length;
      
      return {
        total: acc.total + total,
        unacknowledged: acc.unacknowledged + unacknowledged,
        acknowledged: acc.acknowledged + (total - unacknowledged)
      };
    }, { total: 0, unacknowledged: 0, acknowledged: 0 });

    const taperingRecommendations = medicationsWithPrevention.filter(med => 
      med.dependencePrevention?.taperingRecommended
    ).length;

    return {
      riskDistribution: Object.entries(riskDistribution).map(([risk, count]) => ({
        risk,
        count,
        percentage: Math.round((count / activeMedications.length) * 100)
      })),
      alertCounts,
      taperingRecommendations,
      totalMonitored: medicationsWithPrevention.length
    };
  }, [medications, activeMedications.length]);

  const [showExportModal, setShowExportModal] = React.useState(false);

  const handleExportData = () => {
    setShowExportModal(true);
  };

  return (
    <div className="space-y-6">
        {/* Page Header */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="mobile-title text-gray-900">Analytics</h1>
              <p className="mobile-text text-gray-500 mt-1">
                Track your medication adherence and progress
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <select
                value={selectedMedication}
                onChange={(e) => setSelectedMedication(e.target.value)}
                className="mobile-input flex-1 sm:flex-none sm:w-48"
                style={{ fontSize: '16px' }}
              >
                <option value="all">All Medications</option>
                {allMedications.map(med => (
                  <option key={med.id} value={med.id}>
                    {med.name} {!med.isActive && '(Inactive)'}
                  </option>
                ))}
              </select>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as '7d' | '30d' | '90d')}
                className="mobile-input flex-1 sm:flex-none sm:w-36"
                style={{ fontSize: '16px' }}
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
              </select>
              <button
                onClick={handleExportData}
                className="mobile-button btn-secondary inline-flex items-center justify-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>Export</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow border-b border-gray-200">
          <nav className="flex space-x-4 sm:space-x-8 px-4 sm:px-6 overflow-x-auto scrollbar-hide">
            {[
              { id: 'adherence', label: 'Adherence', icon: TrendingUp },
              { id: 'withdrawal', label: 'Withdrawal Progress', icon: Activity },
              { id: 'side-effects', label: 'Side Effects', icon: AlertTriangle },
              { id: 'risk', label: 'Risk Assessment', icon: Shield }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={`flex items-center space-x-2 py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-sm whitespace-nowrap touch-manipulation min-h-[44px] ${
                  activeTab === id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{label.split(' ')[0]}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 sm:p-6 max-h-[calc(100vh-300px)] overflow-y-auto mobile-scroll">
            {/* Adherence Tab */}
            {activeTab === 'adherence' && (
              <div className="space-y-6">
                {/* Stats Overview */}
                <div className="mobile-dashboard-grid">
                  <div className="mobile-card">
          <div className="card-content p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-md flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Overall Adherence
                  </dt>
                    <dd className="flex items-baseline">
                    <div className={`text-2xl font-semibold ${getAdherenceColor(overallStats.overallAdherence)}`}>
                      {Number.isFinite(overallStats.overallAdherence) ? overallStats.overallAdherence : 0}%
                    </div>
                    {Number.isFinite(overallStats.trend) && overallStats.trend !== 0 && (
                      <div className={`ml-2 flex items-baseline text-sm font-semibold ${
                        overallStats.trend > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {overallStats.trend > 0 ? (
                          <TrendingUp className="self-center flex-shrink-0 h-4 w-4" />
                        ) : (
                          <TrendingDown className="self-center flex-shrink-0 h-4 w-4" />
                        )}
                        <span className="sr-only">
                          {overallStats.trend > 0 ? 'Increased' : 'Decreased'} by
                        </span>
                        {Math.abs(overallStats.trend)}%
                      </div>
                    )}
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
                <div className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Doses
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {Number.isFinite(overallStats.totalDoses) ? overallStats.totalDoses : 0}
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
                <div className="w-8 h-8 bg-green-100 rounded-md flex items-center justify-center">
                  <Clock className="h-5 w-5 text-green-600" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Doses Taken
                  </dt>
                  <dd className="text-2xl font-semibold text-green-600">
                    {Number.isFinite(overallStats.takenDoses) ? overallStats.takenDoses : 0}
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
                <div className="w-8 h-8 bg-red-100 rounded-md flex items-center justify-center">
                  <RefreshCw className="h-5 w-5 text-red-600" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Doses Missed
                  </dt>
                  <dd className="text-2xl font-semibold text-red-600">
                    {Number.isFinite(overallStats.missedDoses) ? overallStats.missedDoses : 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Adherence Trend Chart */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Adherence Trend</h3>
          </div>
          <div className="card-content">
            {adherenceData.length > 0 && adherenceData.some(d => Number.isFinite(d.adherence)) ? (
              <ChartErrorBoundary>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={adherenceData.filter(d => Number.isFinite(d.adherence) && Number.isFinite(d.taken) && Number.isFinite(d.missed))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                  <YAxis domain={[0, 100]} allowDecimals={false} ticks={[0, 20, 40, 60, 80, 100]} />
                    <Tooltip 
                      formatter={(value, name) => [
                        `${value}${name === 'adherence' ? '%' : ''}`, 
                        name === 'adherence' ? 'Adherence' : name === 'taken' ? 'Taken' : 'Missed'
                      ]}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="adherence" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartErrorBoundary>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                No data available for the selected time period
              </div>
            )}
          </div>
        </div>

        {/* Adherence Distribution */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Adherence Distribution</h3>
          </div>
          <div className="card-content">
            {adherenceDistribution.length > 0 ? (
              <ChartErrorBoundary>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={adherenceDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {adherenceDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </ChartErrorBoundary>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                No medication data available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Medication Adherence Chart */}
      {medicationChartData.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Adherence by Medication</h3>
          </div>
          <div className="card-content">
            <ChartErrorBoundary>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={medicationChartData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    type="number" 
                    domain={[0, 100]}
                    allowDecimals={false}
                    ticks={[0, 20, 40, 60, 80, 100]}
                    tickFormatter={(value) => Number.isFinite(value) && !isNaN(value) ? `${Math.round(value)}%` : '0%'}
                  />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={120}
                    tickFormatter={(value) => value || 'Unknown'}
                  />
                  <Tooltip 
                    formatter={(value, name) => {
                      const safeValue = Number.isFinite(value) && !isNaN(value) ? Math.round(Number(value)) : 0;
                      return [
                        `${safeValue}${name === 'adherence' ? '%' : ''}`, 
                        name === 'adherence' ? 'Adherence' : name === 'taken' ? 'Taken' : 'Missed'
                      ];
                    }}
                  />
                  <Bar 
                    dataKey="adherence" 
                    fill="#3b82f6"
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartErrorBoundary>
          </div>
        </div>
      )}

      {/* Detailed Medication Reports */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">Medication Reports</h3>
        </div>
        <div className="card-content">
          {medicationAdherence.length === 0 ? (
            <div className="text-center py-8">
              <BarChart3 className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No data available</h3>
              <p className="mt-1 text-sm text-gray-500">
                Start logging your medications to see analytics.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Medication
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Adherence
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Taken
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Missed
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {medicationAdherence.map((report) => (
                    <tr key={report.medicationId}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {report.medicationName}
                        {(() => {
                          const medication = allMedications.find(med => med.id === report.medicationId);
                          return !medication?.isActive ? (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                              Inactive
                            </span>
                          ) : null;
                        })()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className={`text-sm font-medium ${getAdherenceColor(report.adherencePercentage)}`}>
                            {Number.isFinite(report.adherencePercentage) ? report.adherencePercentage : 0}%
                          </span>
                          <div className="ml-2 w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                report.adherencePercentage >= 90 ? 'bg-green-600' :
                                report.adherencePercentage >= 75 ? 'bg-yellow-600' :
                                report.adherencePercentage >= 50 ? 'bg-orange-600' :
                                'bg-red-600'
                              }`}
                              style={{ width: `${Number.isFinite(report.adherencePercentage) ? Math.max(0, Math.min(100, report.adherencePercentage)) : 0}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                        {Number.isFinite(report.takenDoses) ? report.takenDoses : 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                        {Number.isFinite(report.missedDoses) ? report.missedDoses : 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {Number.isFinite(report.totalDoses) ? report.totalDoses : 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
        </div>
      )}

      {/* Withdrawal Progress Tab */}
      {activeTab === 'withdrawal' && (
        <div className="space-y-6">
          {withdrawalProgressData.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">No Withdrawal Tracking Data</h3>
              <p className="mt-1 text-sm text-gray-500">
                Start tracking withdrawal symptoms to see progress analytics here.
              </p>
            </div>
          ) : (
            <>
              {/* Withdrawal Overview Cards */}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <div className="card">
                  <div className="card-content p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-purple-100 rounded-md flex items-center justify-center">
                          <Activity className="h-5 w-5 text-purple-600" />
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Active Withdrawals
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {withdrawalProgressData.reduce((sum, data) => sum + data.activeWithdrawals, 0)}
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
                        <div className="w-8 h-8 bg-green-100 rounded-md flex items-center justify-center">
                          <Activity className="h-5 w-5 text-green-600" />
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Completed Withdrawals
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {withdrawalProgressData.reduce((sum, data) => sum + data.completedWithdrawals, 0)}
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
                        <div className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center">
                          <Heart className="h-5 w-5 text-blue-600" />
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Medications Tracked
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {withdrawalProgressData.length}
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
                        <div className="w-8 h-8 bg-orange-100 rounded-md flex items-center justify-center">
                          <Clock className="h-5 w-5 text-orange-600" />
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Avg Progress
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {withdrawalProgressData.filter(d => d.currentProgress).length > 0
                              ? Math.round(
                                  withdrawalProgressData
                                    .filter(d => d.currentProgress)
                                    .reduce((sum, d) => sum + d.currentProgress!.progressPercent, 0) /
                                  withdrawalProgressData.filter(d => d.currentProgress).length
                                )
                              : 0}%
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Withdrawal Progress Details */}
              <div className="card">
                <div className="card-header">
                  <h3 className="text-lg font-medium text-gray-900">Withdrawal Progress by Medication</h3>
                </div>
                <div className="card-content">
                  <div className="space-y-4">
                    {withdrawalProgressData.map((data) => (
                      <div key={data.medicationId} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium text-gray-900">{data.medicationName}</h4>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span>Active: {data.activeWithdrawals}</span>
                            <span>Completed: {data.completedWithdrawals}</span>
                          </div>
                        </div>
                        
                        {data.currentProgress && (
                          <div className="bg-gray-50 p-3 rounded">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-700">Current Withdrawal Progress</span>
                              <span className="text-sm text-gray-600">{data.currentProgress.daysSinceStart} days</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                              <div
                                className={`h-2 rounded-full ${
                                  data.currentProgress.progressPercent >= 75 ? 'bg-green-500' :
                                  data.currentProgress.progressPercent >= 50 ? 'bg-yellow-500' :
                                  data.currentProgress.progressPercent >= 25 ? 'bg-orange-500' :
                                  'bg-red-500'
                                }`}
                                style={{ width: `${data.currentProgress.progressPercent}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-xs text-gray-600">
                              <span>{data.currentProgress.resolvedCount}/{data.currentProgress.symptomCount} symptoms resolved</span>
                              <span>{data.currentProgress.progressPercent}% complete</span>
                            </div>
                            <div className="mt-2">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                data.currentProgress.severity === 'mild' ? 'bg-green-100 text-green-800' :
                                data.currentProgress.severity === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
                                data.currentProgress.severity === 'severe' ? 'bg-orange-100 text-orange-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {data.currentProgress.severity} severity
                              </span>
                            </div>
                          </div>
                        )}
                        
                        {!data.currentProgress && data.completedWithdrawals > 0 && (
                          <div className="bg-green-50 p-3 rounded">
                            <div className="flex items-center space-x-2">
                              <Activity className="h-4 w-4 text-green-600" />
                              <span className="text-sm text-green-800">
                                {data.completedWithdrawals} successful withdrawal{data.completedWithdrawals !== 1 ? 's' : ''} completed
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Side Effects Tab */}
      {activeTab === 'side-effects' && (
        <div className="space-y-6">
          {sideEffectTrendsData.totalReports === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">No Side Effect Reports</h3>
              <p className="mt-1 text-sm text-gray-500">
                Report side effects to see trend analysis here.
              </p>
            </div>
          ) : (
            <>
              {/* Side Effects Overview */}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <div className="card">
                  <div className="card-content p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-orange-100 rounded-md flex items-center justify-center">
                          <AlertTriangle className="h-5 w-5 text-orange-600" />
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Total Reports
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {sideEffectTrendsData.totalReports}
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
                        <div className="w-8 h-8 bg-red-100 rounded-md flex items-center justify-center">
                          <AlertTriangle className="h-5 w-5 text-red-600" />
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Severe Reports
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {sideEffectTrendsData.severityDistribution.find(s => s.severity === 'severe')?.count || 0}
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
                        <div className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center">
                          <BarChart3 className="h-5 w-5 text-blue-600" />
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Most Common
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {sideEffectTrendsData.topSideEffects[0]?.name || 'None'}
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
                        <div className="w-8 h-8 bg-purple-100 rounded-md flex items-center justify-center">
                          <Heart className="h-5 w-5 text-purple-600" />
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Avg Daily
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {Math.round(sideEffectTrendsData.totalReports / (dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90) * 10) / 10}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Side Effects Trends Chart */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card">
                  <div className="card-header">
                    <h3 className="text-lg font-medium text-gray-900">Daily Side Effect Reports</h3>
                  </div>
                  <div className="card-content">
                    <ChartErrorBoundary>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={sideEffectTrendsData.dailyTrends}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Line type="monotone" dataKey="total" stroke="#f59e0b" strokeWidth={2} />
                          <Line type="monotone" dataKey="severe" stroke="#ef4444" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </ChartErrorBoundary>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <h3 className="text-lg font-medium text-gray-900">Severity Distribution</h3>
                  </div>
                  <div className="card-content">
                    <ChartErrorBoundary>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={sideEffectTrendsData.severityDistribution.map(item => ({
                              name: item.severity,
                              value: item.count,
                              fill: item.severity === 'mild' ? '#10b981' :
                                    item.severity === 'moderate' ? '#f59e0b' :
                                    item.severity === 'severe' ? '#ef4444' : '#dc2626'
                            }))}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            dataKey="value"
                            label={({ name, value }) => `${name}: ${value}`}
                          />
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </ChartErrorBoundary>
                  </div>
                </div>
              </div>

              {/* Top Side Effects */}
              <div className="card">
                <div className="card-header">
                  <h3 className="text-lg font-medium text-gray-900">Most Common Side Effects</h3>
                </div>
                <div className="card-content">
                  <div className="space-y-3">
                    {sideEffectTrendsData.topSideEffects.map((effect, index) => (
                      <div key={effect.name} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div className="flex items-center space-x-3">
                          <span className="w-6 h-6 bg-orange-100 text-orange-800 rounded-full flex items-center justify-center text-xs font-medium">
                            {index + 1}
                          </span>
                          <span className="font-medium text-gray-900">{effect.name}</span>
                        </div>
                        <span className="text-sm text-gray-600">{effect.count} reports</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Risk Assessment Tab */}
      {activeTab === 'risk' && (
        <div className="space-y-6">
          {/* Risk Overview */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card">
              <div className="card-content p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center">
                      <Shield className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Monitored Meds
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {dependencyRiskData.totalMonitored}
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
                    <div className="w-8 h-8 bg-orange-100 rounded-md flex items-center justify-center">
                      <AlertTriangle className="h-5 w-5 text-orange-600" />
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Active Alerts
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {dependencyRiskData.alertCounts.unacknowledged}
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
                    <div className="w-8 h-8 bg-purple-100 rounded-md flex items-center justify-center">
                      <TrendingDown className="h-5 w-5 text-purple-600" />
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Tapering Recommended
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {dependencyRiskData.taperingRecommendations}
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
                    <div className="w-8 h-8 bg-red-100 rounded-md flex items-center justify-center">
                      <Shield className="h-5 w-5 text-red-600" />
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        High Risk Meds
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {dependencyRiskData.riskDistribution.find(r => r.risk === 'high')?.count || 0}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Risk Distribution Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-medium text-gray-900">Risk Level Distribution</h3>
              </div>
              <div className="card-content">
                <ChartErrorBoundary>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={dependencyRiskData.riskDistribution.map(item => ({
                          name: item.risk,
                          value: item.count,
                          fill: item.risk === 'low' ? '#10b981' :
                                item.risk === 'moderate' ? '#f59e0b' :
                                item.risk === 'high' ? '#ef4444' : '#dc2626'
                        }))}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartErrorBoundary>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-medium text-gray-900">Alert Status</h3>
              </div>
              <div className="card-content">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded">
                    <span className="text-sm font-medium text-red-800">Unacknowledged Alerts</span>
                    <span className="text-lg font-bold text-red-900">{dependencyRiskData.alertCounts.unacknowledged}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded">
                    <span className="text-sm font-medium text-green-800">Acknowledged Alerts</span>
                    <span className="text-lg font-bold text-green-900">{dependencyRiskData.alertCounts.acknowledged}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <span className="text-sm font-medium text-gray-800">Total Alerts</span>
                    <span className="text-lg font-bold text-gray-900">{dependencyRiskData.alertCounts.total}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
              </div>
            )}
          </div>
        </div>
        </div>

        {/* Export Modal */}
        <ExportModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
        />
    </div>
  );
}
