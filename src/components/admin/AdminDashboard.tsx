import { useState, useEffect } from 'react';
import {
  Shield,
  Activity,
  Database,
  Users,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  Download,
  Eye,
  Lock,
  CheckCircle,
  FileText,
  LogOut,
  RefreshCw,
  Zap,
  Target,
  Brain,
  Radar,
  LineChart
} from 'lucide-react';
import { secretSequenceTracker } from '@/services/secretSequenceTracker';
import { securityService } from '@/services/securityService';
import { analyticsService } from '@/services/analyticsService';
import {
  AdvancedLineChart,
  CorrelationHeatmap,
  RiskRadarChart,
  MedicationTreemap,
  RealTimeMonitor,
  PredictiveChart
} from './AdvancedVisualization';

interface AdminDashboardData {
  overview: {
    totalAnonymousRecords: number;
    totalConsents: number;
    totalReports: number;
    totalAuditLogs: number;
    recentSubmissions: number;
    recentConsents: number;
  };
  dataQuality: {
    privacyValidatedRecords: number;
    validationRate: number;
    avgPrivacyScore: number;
    kAnonymityStats: {
      avgKLevel: number;
      minKLevel: number;
      maxKLevel: number;
    };
  };
  breakdowns: {
    dataTypes: Array<{ _id: string; count: number }>;
    privacyLevels: Array<{ _id: string; count: number }>;
  };
  security: {
    highRiskAudits: number;
    flaggedAudits: number;
    totalSecurityEvents: number;
  };
  systemHealth: {
    dataQuality: number;
    privacyCompliance: number;
    consentRate: number;
    kAnonymityCompliance: number;
    securityAlerts: number;
  };
  accessLevel: string;
  permissions: string[];
}

interface AdvancedAnalyticsData {
  overview: any;
  trends: any[];
  insights: any[];
  predictions: any[];
  correlations: any[];
  anomalies: any[];
  performance: any;
}

interface SecurityDashboardData {
  activeSessions: number;
  recentEvents: any[];
  threatLevel: string;
  riskScore: number;
}

interface AdminDashboardProps {
  isVisible: boolean;
  onClose: () => void;
}

export function AdminDashboard({ isVisible, onClose }: AdminDashboardProps) {
  const [dashboardData, setDashboardData] = useState<AdminDashboardData | null>(null);
  const [advancedAnalytics, setAdvancedAnalytics] = useState<AdvancedAnalyticsData | null>(null);
  const [securityDashboard, setSecurityDashboard] = useState<SecurityDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'security' | 'monitoring' | 'ml-insights' | 'export'>('overview');
  const [realtimeData, setRealtimeData] = useState<any>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const loadAdvancedAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const analytics = await analyticsService.generateComprehensiveAnalytics();
      setAdvancedAnalytics(analytics);
    } catch (error) {
      console.error('Error loading advanced analytics:', error);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const loadSecurityDashboard = () => {
    try {
      const securityData = securityService.getSecurityDashboard();
      setSecurityDashboard(securityData);
    } catch (error) {
      console.error('Error loading security dashboard:', error);
    }
  };

  useEffect(() => {
    if (isVisible) {
      loadDashboardData();
      loadAdvancedAnalytics();
      loadSecurityDashboard();
      
      if (autoRefresh) {
        const interval = setInterval(() => {
          loadDashboardData();
          loadSecurityDashboard();
          if (activeTab === 'analytics' || activeTab === 'ml-insights') {
            loadAdvancedAnalytics();
          }
        }, 30000); // Refresh every 30 seconds
        return () => clearInterval(interval);
      }
    }
  }, [isVisible, autoRefresh, activeTab]);

  const loadDashboardData = async () => {
    try {
      const token = secretSequenceTracker.getAdminToken();
      if (!token) return;

      // Check if using development token
      if (token === 'dev-admin-token') {
        // Load mock data for development
        const mockData: AdminDashboardData = {
          overview: {
            totalAnonymousRecords: 15420,
            totalConsents: 12850,
            totalReports: 342,
            totalAuditLogs: 8921,
            recentSubmissions: 127,
            recentConsents: 89
          },
          dataQuality: {
            privacyValidatedRecords: 14950,
            validationRate: 97.1,
            avgPrivacyScore: 8.7,
            kAnonymityStats: {
              avgKLevel: 12.4,
              minKLevel: 5,
              maxKLevel: 25
            }
          },
          breakdowns: {
            dataTypes: [
              { _id: 'adherence', count: 5230 },
              { _id: 'side_effect', count: 3420 },
              { _id: 'medication_pattern', count: 4210 },
              { _id: 'risk_assessment', count: 2560 }
            ],
            privacyLevels: [
              { _id: 'standard', count: 8920 },
              { _id: 'enhanced', count: 3850 },
              { _id: 'minimal', count: 2650 }
            ]
          },
          security: {
            highRiskAudits: 3,
            flaggedAudits: 1,
            totalSecurityEvents: 4
          },
          systemHealth: {
            dataQuality: 97.1,
            privacyCompliance: 99.2,
            consentRate: 83.3,
            kAnonymityCompliance: 100,
            securityAlerts: 4
          },
          accessLevel: 'superadmin',
          permissions: ['view_all_data', 'generate_reports', 'manage_users', 'export_data']
        };
        
        console.log('📊 Loading mock admin dashboard data for development');
        setDashboardData(mockData);
        setLoading(false);
        return;
      }

      // Production API call
      const response = await fetch(`${import.meta.env.VITE_ANONYMOUS_API_URL}/admin/dashboard`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        setDashboardData(result.data);
      } else if (response.status === 401) {
        // Token expired, logout
        handleLogout();
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      // If we're in development and there's an error, show mock data
      if (import.meta.env.DEV) {
        console.log('🔧 API unavailable, using mock data for development');
        // Use the same mock data as above
        const mockData: AdminDashboardData = {
          overview: {
            totalAnonymousRecords: 15420,
            totalConsents: 12850,
            totalReports: 342,
            totalAuditLogs: 8921,
            recentSubmissions: 127,
            recentConsents: 89
          },
          dataQuality: {
            privacyValidatedRecords: 14950,
            validationRate: 97.1,
            avgPrivacyScore: 8.7,
            kAnonymityStats: {
              avgKLevel: 12.4,
              minKLevel: 5,
              maxKLevel: 25
            }
          },
          breakdowns: {
            dataTypes: [
              { _id: 'adherence', count: 5230 },
              { _id: 'side_effect', count: 3420 },
              { _id: 'medication_pattern', count: 4210 },
              { _id: 'risk_assessment', count: 2560 }
            ],
            privacyLevels: [
              { _id: 'standard', count: 8920 },
              { _id: 'enhanced', count: 3850 },
              { _id: 'minimal', count: 2650 }
            ]
          },
          security: {
            highRiskAudits: 3,
            flaggedAudits: 1,
            totalSecurityEvents: 4
          },
          systemHealth: {
            dataQuality: 97.1,
            privacyCompliance: 99.2,
            consentRate: 83.3,
            kAnonymityCompliance: 100,
            securityAlerts: 4
          },
          accessLevel: 'superadmin',
          permissions: ['view_all_data', 'generate_reports', 'manage_users', 'export_data']
        };
        setDashboardData(mockData);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadRealtimeData = async () => {
    try {
      const token = secretSequenceTracker.getAdminToken();
      if (!token) return;

      // Check if using development token
      if (token === 'dev-admin-token' || import.meta.env.DEV) {
        // Load mock realtime data for development
        const mockRealtimeData = {
          timestamp: new Date(),
          metrics: {
            submissionRate: {
              lastHour: Math.floor(Math.random() * 50) + 10,
              lastDay: Math.floor(Math.random() * 500) + 200,
              rate: Math.floor(Math.random() * 1200) + 400
            },
            validation: {
              totalSubmissions: Math.floor(Math.random() * 1000) + 500,
              validatedSubmissions: Math.floor(Math.random() * 950) + 450,
              avgValidationScore: 8.5 + Math.random() * 1.5,
              failedValidations: Math.floor(Math.random() * 10)
            },
            consent: {
              activeConsents: Math.floor(Math.random() * 5000) + 10000,
              recentChanges: Math.floor(Math.random() * 20) + 5
            },
            security: {
              recentViolations: Math.floor(Math.random() * 3),
              flaggedEvents: Math.floor(Math.random() * 2)
            }
          }
        };
        
        console.log('📈 Loading mock realtime data for development');
        setRealtimeData(mockRealtimeData);
        return;
      }

      // Production API call
      const response = await fetch(`${import.meta.env.VITE_ANONYMOUS_API_URL}/admin/monitoring/realtime`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        setRealtimeData(result.data);
      }
    } catch (error) {
      console.error('Error loading realtime data:', error);
      // Show mock data on error in development
      if (import.meta.env.DEV) {
        const mockRealtimeData = {
          timestamp: new Date(),
          metrics: {
            submissionRate: {
              lastHour: 25,
              lastDay: 350,
              rate: 600
            },
            security: {
              recentViolations: 0,
              flaggedEvents: 0
            }
          }
        };
        setRealtimeData(mockRealtimeData);
      }
    }
  };

  const exportResearchDataset = async (format: 'json' | 'csv') => {
    try {
      const token = secretSequenceTracker.getAdminToken();
      if (!token) return;

      const response = await fetch(`${import.meta.env.VITE_ANONYMOUS_API_URL}/admin/export/research-dataset`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          format,
          dataTypes: ['adherence', 'side_effect', 'medication_pattern'],
          minKAnonymity: 5
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `research-dataset-${Date.now()}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error exporting dataset:', error);
    }
  };

  const handleLogout = () => {
    secretSequenceTracker.logoutAdmin();
    onClose();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-7xl w-full max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white bg-opacity-20 rounded-lg">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">System Administration Panel</h2>
              <p className="text-sm opacity-90">
                Access Level: {dashboardData?.accessLevel} | 
                Last Updated: {new Date().toLocaleTimeString()}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                autoRefresh ? 'bg-green-500' : 'bg-gray-500'
              }`}
            >
              <RefreshCw className="w-4 h-4" />
              <span>Auto Refresh</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-3 py-2 bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 bg-gray-50 overflow-x-auto">
          {[
            { id: 'overview', label: 'System Overview', icon: Activity },
            { id: 'analytics', label: 'Advanced Analytics', icon: BarChart3 },
            { id: 'security', label: 'Security Center', icon: Shield },
            { id: 'monitoring', label: 'Real-time Monitoring', icon: Eye },
            { id: 'ml-insights', label: 'ML Insights', icon: Brain },
            { id: 'export', label: 'Data Export', icon: Download }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-6 py-4 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-white border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(95vh-180px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading admin dashboard...</span>
            </div>
          ) : dashboardData ? (
            <>
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* System Health Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-blue-600 font-medium">Data Quality</p>
                          <p className="text-2xl font-bold text-blue-900">
                            {dashboardData.systemHealth.dataQuality.toFixed(1)}%
                          </p>
                        </div>
                        <CheckCircle className="w-8 h-8 text-blue-600" />
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg border border-green-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-green-600 font-medium">Privacy Compliance</p>
                          <p className="text-2xl font-bold text-green-900">
                            {dashboardData.systemHealth.privacyCompliance.toFixed(1)}%
                          </p>
                        </div>
                        <Lock className="w-8 h-8 text-green-600" />
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-lg border border-purple-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-purple-600 font-medium">K-Anonymity</p>
                          <p className="text-2xl font-bold text-purple-900">
                            {dashboardData.systemHealth.kAnonymityCompliance.toFixed(0)}%
                          </p>
                        </div>
                        <Users className="w-8 h-8 text-purple-600" />
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-lg border border-red-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-red-600 font-medium">Security Alerts</p>
                          <p className="text-2xl font-bold text-red-900">
                            {dashboardData.systemHealth.securityAlerts}
                          </p>
                        </div>
                        <AlertTriangle className="w-8 h-8 text-red-600" />
                      </div>
                    </div>
                  </div>

                  {/* Overview Statistics */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-lg border border-gray-200">
                      <h3 className="text-lg font-semibold mb-4 flex items-center">
                        <Database className="w-5 h-5 mr-2 text-blue-600" />
                        Data Overview
                      </h3>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Total Anonymous Records</span>
                          <span className="font-semibold">{dashboardData.overview.totalAnonymousRecords.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Active Consents</span>
                          <span className="font-semibold">{dashboardData.overview.totalConsents.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Generated Reports</span>
                          <span className="font-semibold">{dashboardData.overview.totalReports.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Audit Log Entries</span>
                          <span className="font-semibold">{dashboardData.overview.totalAuditLogs.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-lg border border-gray-200">
                      <h3 className="text-lg font-semibold mb-4 flex items-center">
                        <TrendingUp className="w-5 h-5 mr-2 text-green-600" />
                        Recent Activity
                      </h3>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Recent Submissions</span>
                          <span className="font-semibold text-green-600">
                            {dashboardData.overview.recentSubmissions}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Recent Consents</span>
                          <span className="font-semibold text-blue-600">
                            {dashboardData.overview.recentConsents}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Validation Rate</span>
                          <span className="font-semibold text-purple-600">
                            {dashboardData.dataQuality.validationRate.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Security Events</span>
                          <span className={`font-semibold ${
                            dashboardData.security.totalSecurityEvents > 0 ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {dashboardData.security.totalSecurityEvents}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Data Type Breakdown */}
                  <div className="bg-white p-6 rounded-lg border border-gray-200">
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                      <BarChart3 className="w-5 h-5 mr-2 text-indigo-600" />
                      Data Type Distribution
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {dashboardData.breakdowns.dataTypes.map((type) => (
                        <div key={type._id} className="text-center p-4 bg-gray-50 rounded-lg">
                          <div className="text-2xl font-bold text-gray-900 mb-1">
                            {type.count.toLocaleString()}
                          </div>
                          <div className="text-sm text-gray-600 capitalize">
                            {type._id.replace('_', ' ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Analytics Tab */}
              {activeTab === 'analytics' && (
                <div className="space-y-6">
                  {analyticsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <span className="ml-3 text-gray-600">Loading advanced analytics...</span>
                    </div>
                  ) : advancedAnalytics ? (
                    <>
                      {/* Analytics Overview Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg border border-blue-200">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-blue-600 font-medium">Total Insights</p>
                              <p className="text-2xl font-bold text-blue-900">{advancedAnalytics.insights.length}</p>
                            </div>
                            <Brain className="w-8 h-8 text-blue-600" />
                          </div>
                        </div>

                        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg border border-green-200">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-green-600 font-medium">Prediction Accuracy</p>
                              <p className="text-2xl font-bold text-green-900">
                                {advancedAnalytics.predictions[0]?.accuracy ? `${(advancedAnalytics.predictions[0].accuracy * 100).toFixed(1)}%` : 'N/A'}
                              </p>
                            </div>
                            <Target className="w-8 h-8 text-green-600" />
                          </div>
                        </div>

                        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-lg border border-purple-200">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-purple-600 font-medium">Correlations Found</p>
                              <p className="text-2xl font-bold text-purple-900">{advancedAnalytics.correlations.length}</p>
                            </div>
                            <TrendingUp className="w-8 h-8 text-purple-600" />
                          </div>
                        </div>

                        <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-lg border border-red-200">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-red-600 font-medium">Anomalies Detected</p>
                              <p className="text-2xl font-bold text-red-900">{advancedAnalytics.anomalies.length}</p>
                            </div>
                            <AlertTriangle className="w-8 h-8 text-red-600" />
                          </div>
                        </div>
                      </div>

                      {/* Advanced Visualizations */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <AdvancedLineChart 
                          data={advancedAnalytics.trends}
                          title="Medication Trends Analysis"
                          realtime={true}
                        />
                        
                        <CorrelationHeatmap 
                          data={advancedAnalytics.correlations}
                          title="Factor Correlations"
                        />
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <RiskRadarChart 
                          data={null}
                          title="Risk Assessment Radar"
                        />
                        
                        <MedicationTreemap 
                          data={null}
                          title="Medication Category Distribution"
                        />
                      </div>

                      {/* Insights and Recommendations */}
                      <div className="bg-white p-6 rounded-lg border border-gray-200">
                        <h3 className="text-lg font-semibold mb-4 flex items-center">
                          <Brain className="w-5 h-5 mr-2 text-purple-600" />
                          Advanced Insights & Recommendations
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {advancedAnalytics.insights.slice(0, 4).map((insight, index) => (
                            <div key={index} className={`p-4 rounded-lg border-l-4 ${
                              insight.impact === 'critical' ? 'border-red-500 bg-red-50' :
                              insight.impact === 'high' ? 'border-orange-500 bg-orange-50' :
                              insight.impact === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                              'border-blue-500 bg-blue-50'
                            }`}>
                              <div className="flex items-start justify-between mb-2">
                                <h4 className="font-medium text-gray-900 text-sm">{insight.title}</h4>
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  insight.impact === 'critical' ? 'bg-red-100 text-red-800' :
                                  insight.impact === 'high' ? 'bg-orange-100 text-orange-800' :
                                  insight.impact === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-blue-100 text-blue-800'
                                }`}>
                                  {insight.impact}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 mb-2">{insight.description}</p>
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500">
                                  Confidence: {(insight.confidence * 100).toFixed(0)}%
                                </span>
                                {insight.actionable && (
                                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                                    Actionable
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-12">
                      <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">Unable to load advanced analytics</p>
                      <button
                        onClick={loadAdvancedAnalytics}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Security Tab */}
              {activeTab === 'security' && (
                <div className="space-y-6">
                  {securityDashboard ? (
                    <>
                      {/* Security Overview */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg border border-green-200">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-green-600 font-medium">Active Sessions</p>
                              <p className="text-2xl font-bold text-green-900">{securityDashboard.activeSessions}</p>
                            </div>
                            <Shield className="w-8 h-8 text-green-600" />
                          </div>
                        </div>

                        <div className={`bg-gradient-to-br p-6 rounded-lg border ${
                          securityDashboard.threatLevel === 'CRITICAL' ? 'from-red-50 to-red-100 border-red-200' :
                          securityDashboard.threatLevel === 'HIGH' ? 'from-orange-50 to-orange-100 border-orange-200' :
                          securityDashboard.threatLevel === 'MEDIUM' ? 'from-yellow-50 to-yellow-100 border-yellow-200' :
                          'from-green-50 to-green-100 border-green-200'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className={`text-sm font-medium ${
                                securityDashboard.threatLevel === 'CRITICAL' ? 'text-red-600' :
                                securityDashboard.threatLevel === 'HIGH' ? 'text-orange-600' :
                                securityDashboard.threatLevel === 'MEDIUM' ? 'text-yellow-600' :
                                'text-green-600'
                              }`}>Threat Level</p>
                              <p className={`text-2xl font-bold ${
                                securityDashboard.threatLevel === 'CRITICAL' ? 'text-red-900' :
                                securityDashboard.threatLevel === 'HIGH' ? 'text-orange-900' :
                                securityDashboard.threatLevel === 'MEDIUM' ? 'text-yellow-900' :
                                'text-green-900'
                              }`}>{securityDashboard.threatLevel}</p>
                            </div>
                            <AlertTriangle className={`w-8 h-8 ${
                              securityDashboard.threatLevel === 'CRITICAL' ? 'text-red-600' :
                              securityDashboard.threatLevel === 'HIGH' ? 'text-orange-600' :
                              securityDashboard.threatLevel === 'MEDIUM' ? 'text-yellow-600' :
                              'text-green-600'
                            }`} />
                          </div>
                        </div>

                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg border border-blue-200">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-blue-600 font-medium">Risk Score</p>
                              <p className="text-2xl font-bold text-blue-900">{(securityDashboard.riskScore * 100).toFixed(0)}%</p>
                            </div>
                            <Target className="w-8 h-8 text-blue-600" />
                          </div>
                        </div>

                        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-lg border border-purple-200">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-purple-600 font-medium">Recent Events</p>
                              <p className="text-2xl font-bold text-purple-900">{securityDashboard.recentEvents.length}</p>
                            </div>
                            <Activity className="w-8 h-8 text-purple-600" />
                          </div>
                        </div>
                      </div>

                      {/* Security Events */}
                      <div className="bg-white p-6 rounded-lg border border-gray-200">
                        <h3 className="text-lg font-semibold mb-4 flex items-center">
                          <Shield className="w-5 h-5 mr-2 text-blue-600" />
                          Recent Security Events
                        </h3>
                        <div className="space-y-3">
                          {securityDashboard.recentEvents.length === 0 ? (
                            <p className="text-gray-500 italic">No recent security events</p>
                          ) : (
                            securityDashboard.recentEvents.map((event, index) => (
                              <div key={index} className={`p-3 rounded-lg border-l-4 ${
                                event.severity === 'critical' ? 'border-red-500 bg-red-50' :
                                event.severity === 'high' ? 'border-orange-500 bg-orange-50' :
                                event.severity === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                                'border-blue-500 bg-blue-50'
                              }`}>
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-2">
                                      <span className="font-medium text-gray-900">
                                        {event.eventType.replace(/_/g, ' ').toUpperCase()}
                                      </span>
                                      <span className={`px-2 py-1 text-xs rounded-full ${
                                        event.severity === 'critical' ? 'bg-red-100 text-red-800' :
                                        event.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                                        event.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                        'bg-blue-100 text-blue-800'
                                      }`}>
                                        {event.severity}
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-600 mt-1">
                                      {new Date(event.timestamp).toLocaleString()}
                                    </p>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    {event.resolved ? (
                                      <CheckCircle className="w-5 h-5 text-green-500" />
                                    ) : (
                                      <AlertTriangle className="w-5 h-5 text-yellow-500" />
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-12">
                      <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">Unable to load security dashboard</p>
                      <button
                        onClick={loadSecurityDashboard}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Monitoring Tab */}
              {activeTab === 'monitoring' && (
                <div className="space-y-6">
                  <RealTimeMonitor title="System Performance Monitor" />
                  
                  {realtimeData && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="bg-white p-6 rounded-lg border border-gray-200">
                        <h4 className="font-semibold mb-4 flex items-center">
                          <Activity className="w-5 h-5 mr-2 text-blue-600" />
                          Performance Metrics
                        </h4>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span>Submissions (Last Hour)</span>
                            <span className="font-semibold">{realtimeData.metrics.submissionRate.lastHour}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Submissions (Last Day)</span>
                            <span className="font-semibold">{realtimeData.metrics.submissionRate.lastDay}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Projected Daily Rate</span>
                            <span className="font-semibold">{realtimeData.metrics.submissionRate.rate}</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white p-6 rounded-lg border border-gray-200">
                        <h4 className="font-semibold mb-4 flex items-center">
                          <Shield className="w-5 h-5 mr-2 text-red-600" />
                          Security Status
                        </h4>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span>Recent Violations</span>
                            <span className={`font-semibold ${
                              realtimeData.metrics.security.recentViolations > 0 ? 'text-red-600' : 'text-green-600'
                            }`}>
                              {realtimeData.metrics.security.recentViolations}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Flagged Events</span>
                            <span className={`font-semibold ${
                              realtimeData.metrics.security.flaggedEvents > 0 ? 'text-red-600' : 'text-green-600'
                            }`}>
                              {realtimeData.metrics.security.flaggedEvents}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ML Insights Tab */}
              {activeTab === 'ml-insights' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <PredictiveChart 
                      data={null}
                      title="Predictive Analytics Dashboard"
                    />
                    
                    <div className="bg-white p-6 rounded-lg border border-gray-200">
                      <h3 className="text-lg font-semibold mb-4 flex items-center">
                        <Brain className="w-5 h-5 mr-2 text-purple-600" />
                        Machine Learning Models
                      </h3>
                      <div className="space-y-4">
                        {advancedAnalytics?.predictions.map((model, index) => (
                          <div key={index} className="p-4 bg-gray-50 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-gray-900 capitalize">
                                {model.type.replace('_', ' ')} Model
                              </span>
                              <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded-full">
                                {(model.accuracy * 100).toFixed(1)}% accuracy
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                              Features: {model.features.join(', ')}
                            </p>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-green-600 h-2 rounded-full" 
                                style={{ width: `${model.accuracy * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        )) || (
                          <p className="text-gray-500 italic">Loading ML models...</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {advancedAnalytics && (
                    <div className="bg-white p-6 rounded-lg border border-gray-200">
                      <h3 className="text-lg font-semibold mb-4 flex items-center">
                        <Zap className="w-5 h-5 mr-2 text-yellow-600" />
                        Statistical Analysis Results
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="p-4 bg-blue-50 rounded-lg">
                          <h4 className="font-medium text-blue-900 mb-2">Correlation Analysis</h4>
                          <p className="text-sm text-blue-700">
                            Found {advancedAnalytics.correlations.filter(c => c.significant).length} significant correlations
                          </p>
                          <div className="mt-2">
                            {advancedAnalytics.correlations.slice(0, 2).map((corr, index) => (
                              <div key={index} className="text-xs text-blue-600">
                                {corr.variables.join(' ↔ ')}: {corr.correlation.toFixed(3)}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="p-4 bg-red-50 rounded-lg">
                          <h4 className="font-medium text-red-900 mb-2">Anomaly Detection</h4>
                          <p className="text-sm text-red-700">
                            Detected {advancedAnalytics.anomalies.length} anomaly patterns
                          </p>
                          <div className="mt-2">
                            {advancedAnalytics.anomalies.slice(0, 2).map((anomaly, index) => (
                              <div key={index} className="text-xs text-red-600">
                                {anomaly.type}: {anomaly.count} instances
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="p-4 bg-green-50 rounded-lg">
                          <h4 className="font-medium text-green-900 mb-2">Performance Metrics</h4>
                          <p className="text-sm text-green-700">
                            Data quality: {(advancedAnalytics.performance.dataQuality.accuracy * 100).toFixed(1)}%
                          </p>
                          <div className="mt-2">
                            <div className="text-xs text-green-600">
                              Processing: {advancedAnalytics.performance.processingTime.average}ms avg
                            </div>
                            <div className="text-xs text-green-600">
                              Uptime: {(advancedAnalytics.performance.systemHealth.uptime * 100).toFixed(2)}%
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Export Tab */}
              {activeTab === 'export' && (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-lg border border-gray-200">
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                      <Download className="w-5 h-5 mr-2 text-green-600" />
                      Research Dataset Export
                    </h3>
                    <p className="text-gray-600 mb-6">
                      Export anonymized research datasets for medical research and analysis.
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button
                        onClick={() => exportResearchDataset('json')}
                        className="flex items-center justify-center space-x-2 p-4 border-2 border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                      >
                        <FileText className="w-5 h-5 text-blue-600" />
                        <span>Export as JSON</span>
                      </button>
                      
                      <button
                        onClick={() => exportResearchDataset('csv')}
                        className="flex items-center justify-center space-x-2 p-4 border-2 border-green-200 rounded-lg hover:bg-green-50 transition-colors"
                      >
                        <BarChart3 className="w-5 h-5 text-green-600" />
                        <span>Export as CSV</span>
                      </button>
                    </div>

                    <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-start space-x-2">
                        <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-yellow-800">
                          <p className="font-medium mb-1">Privacy Notice</p>
                          <p>All exported data is completely anonymized. Individual users cannot be identified from this data. K-anonymity level is maintained at minimum 5 participants per data point.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <p className="text-gray-600">Unable to load admin dashboard data</p>
              <button
                onClick={loadDashboardData}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
