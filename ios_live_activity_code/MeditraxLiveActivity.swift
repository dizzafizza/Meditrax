import ActivityKit
import WidgetKit
import SwiftUI

/// Main Live Activity Widget for Meditrax
/// Displays medication effect tracking on lock screen and Dynamic Island
/// Reference: https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities
@available(iOS 16.2, *)
struct MeditraxLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: MeditraxLiveActivityAttributes.self) { context in
            // Lock screen / banner UI
            LockScreenLiveActivityView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                // MARK: - Expanded Region
                // Displayed when user long-presses the Dynamic Island
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 4) {
                        Image(systemName: "pills.circle.fill")
                            .foregroundStyle(Color(hex: context.state.medicationColor))
                            .font(.title2)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(context.state.medicationName)
                                .font(.caption)
                                .fontWeight(.semibold)
                            Text(context.state.medicationDosage)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                
                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment: .trailing, spacing: 2) {
                        Text("\(context.state.minutesElapsed)m")
                            .font(.title2)
                            .fontWeight(.bold)
                            .monospacedDigit()
                        Text(context.state.phaseDescription)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
                
                DynamicIslandExpandedRegion(.center) {
                    // Empty - content in leading/trailing
                }
                
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(spacing: 8) {
                        // Progress bar with phase indicators
                        EffectProgressBar(
                            progress: context.state.progress,
                            phase: context.state.currentPhase,
                            onsetPct: Double(context.state.onsetMinutes) / Double(context.state.durationMinutes),
                            peakPct: Double(context.state.peakMinutes) / Double(context.state.durationMinutes),
                            wearOffPct: Double(context.state.wearOffMinutes) / Double(context.state.durationMinutes)
                        )
                        
                        // Phase status indicator
                        HStack(spacing: 12) {
                            PhaseIndicator(
                                emoji: getPhaseEmoji(context.state.currentPhase),
                                label: getPhaseLabel(context.state.currentPhase),
                                isActive: true
                            )
                            
                            Spacer()
                            
                            Text("Tap to open Meditrax")
                                .font(.caption2)
                                .foregroundStyle(.tertiary)
                        }
                    }
                    .padding(.horizontal)
                }
                
            } compactLeading: {
                // MARK: - Compact Leading (Always visible on Dynamic Island)
                Image(systemName: "pills.fill")
                    .foregroundStyle(Color(hex: context.state.medicationColor))
            } compactTrailing: {
                // MARK: - Compact Trailing (Timer)
                Text("\(context.state.minutesElapsed)m")
                    .font(.caption2)
                    .fontWeight(.semibold)
                    .monospacedDigit()
                    .foregroundStyle(getPhaseColor(context.state.currentPhase))
            } minimal: {
                // MARK: - Minimal (When multiple activities or limited space)
                Image(systemName: getPhaseIcon(context.state.currentPhase))
                    .foregroundStyle(getPhaseColor(context.state.currentPhase))
            }
            .keylineTint(Color(hex: context.state.medicationColor))
        }
    }
    
    // MARK: - Helper Functions
    
    func getPhaseColor(_ phase: String) -> Color {
        switch phase {
        case "pre_onset":
            return .blue
        case "kicking_in":
            return .cyan
        case "peaking":
            return .green
        case "wearing_off":
            return .orange
        case "worn_off":
            return .gray
        default:
            return .blue
        }
    }
    
    func getPhaseEmoji(_ phase: String) -> String {
        switch phase {
        case "pre_onset": return "⏱️"
        case "kicking_in": return "🔄"
        case "peaking": return "🎯"
        case "wearing_off": return "📉"
        case "worn_off": return "✅"
        default: return "💊"
        }
    }
    
    func getPhaseIcon(_ phase: String) -> String {
        switch phase {
        case "pre_onset": return "clock.fill"
        case "kicking_in": return "arrow.up.circle.fill"
        case "peaking": return "chart.line.uptrend.xyaxis"
        case "wearing_off": return "arrow.down.circle.fill"
        case "worn_off": return "checkmark.circle.fill"
        default: return "pills.fill"
        }
    }
    
    func getPhaseLabel(_ phase: String) -> String {
        switch phase {
        case "pre_onset": return "Starting"
        case "kicking_in": return "Kicking In"
        case "peaking": return "Peaking"
        case "wearing_off": return "Wearing Off"
        case "worn_off": return "Complete"
        default: return "Tracking"
        }
    }
}

// MARK: - Lock Screen View

@available(iOS 16.2, *)
struct LockScreenLiveActivityView: View {
    let context: ActivityViewContext<MeditraxLiveActivityAttributes>
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header with medication info
            HStack {
                Image(systemName: "pills.circle.fill")
                    .foregroundStyle(Color(hex: context.state.medicationColor))
                    .font(.title2)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(context.state.medicationName)
                        .font(.headline)
                        .fontWeight(.semibold)
                    Text(context.state.medicationDosage)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                
                Spacer()
                
                VStack(alignment: .trailing, spacing: 2) {
                    Text("\(context.state.minutesElapsed) min")
                        .font(.title3)
                        .fontWeight(.bold)
                        .monospacedDigit()
                    Text("elapsed")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            
            // Progress bar
            EffectProgressBar(
                progress: context.state.progress,
                phase: context.state.currentPhase,
                onsetPct: Double(context.state.onsetMinutes) / Double(context.state.durationMinutes),
                peakPct: Double(context.state.peakMinutes) / Double(context.state.durationMinutes),
                wearOffPct: Double(context.state.wearOffMinutes) / Double(context.state.durationMinutes)
            )
            .frame(height: 8)
            
            // Current phase and next milestone
            HStack {
                HStack(spacing: 6) {
                    Text(getPhaseEmoji(for: context.state.currentPhase))
                        .font(.title3)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(getPhaseLabel(for: context.state.currentPhase))
                            .font(.caption)
                            .fontWeight(.semibold)
                        Text(context.state.phaseDescription)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
                
                Spacer()
                
                // Time remaining
                if context.state.currentPhase != "worn_off" {
                    VStack(alignment: .trailing, spacing: 1) {
                        Text("\(context.state.timeRemaining)m")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .monospacedDigit()
                        Text("remaining")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
        .padding(16)
        .activityBackgroundTint(Color(hex: context.state.medicationColor).opacity(0.1))
        .activitySystemActionForegroundColor(Color(hex: context.state.medicationColor))
    }
    
    func getPhaseEmoji(for phase: String) -> String {
        switch phase {
        case "pre_onset": return "⏱️"
        case "kicking_in": return "🔄"
        case "peaking": return "🎯"
        case "wearing_off": return "📉"
        case "worn_off": return "✅"
        default: return "💊"
        }
    }
    
    func getPhaseLabel(for phase: String) -> String {
        switch phase {
        case "pre_onset": return "Starting"
        case "kicking_in": return "Kicking In"
        case "peaking": return "Peaking"
        case "wearing_off": return "Wearing Off"
        case "worn_off": return "Complete"
        default: return "Tracking"
        }
    }
}

// MARK: - Effect Progress Bar Component

@available(iOS 16.0, *)
struct EffectProgressBar: View {
    let progress: Double
    let phase: String
    let onsetPct: Double
    let peakPct: Double
    let wearOffPct: Double
    
    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                // Background track
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color.gray.opacity(0.2))
                
                // Progress fill with gradient based on phase
                RoundedRectangle(cornerRadius: 4)
                    .fill(getPhaseGradient())
                    .frame(width: geometry.size.width * min(1.0, max(0.0, progress)))
                
                // Phase milestone markers
                HStack(spacing: 0) {
                    // Onset marker
                    Spacer()
                        .frame(width: geometry.size.width * onsetPct - 1)
                    Rectangle()
                        .fill(Color.white.opacity(0.5))
                        .frame(width: 2)
                    
                    Spacer()
                        .frame(width: geometry.size.width * (peakPct - onsetPct) - 1)
                    Rectangle()
                        .fill(Color.white.opacity(0.5))
                        .frame(width: 2)
                    
                    Spacer()
                        .frame(width: geometry.size.width * (wearOffPct - peakPct) - 1)
                    Rectangle()
                        .fill(Color.white.opacity(0.5))
                        .frame(width: 2)
                    
                    Spacer()
                }
            }
        }
    }
    
    func getPhaseGradient() -> LinearGradient {
        switch phase {
        case "pre_onset":
            return LinearGradient(
                colors: [.blue, .cyan],
                startPoint: .leading,
                endPoint: .trailing
            )
        case "kicking_in":
            return LinearGradient(
                colors: [.cyan, .green],
                startPoint: .leading,
                endPoint: .trailing
            )
        case "peaking":
            return LinearGradient(
                colors: [.green, .green],
                startPoint: .leading,
                endPoint: .trailing
            )
        case "wearing_off":
            return LinearGradient(
                colors: [.green, .orange],
                startPoint: .leading,
                endPoint: .trailing
            )
        case "worn_off":
            return LinearGradient(
                colors: [.gray, .gray],
                startPoint: .leading,
                endPoint: .trailing
            )
        default:
            return LinearGradient(
                colors: [.blue, .blue],
                startPoint: .leading,
                endPoint: .trailing
            )
        }
    }
}

// MARK: - Phase Indicator Component

@available(iOS 16.0, *)
struct PhaseIndicator: View {
    let emoji: String
    let label: String
    let isActive: Bool
    
    var body: some View {
        HStack(spacing: 4) {
            Text(emoji)
                .font(.caption)
            Text(label)
                .font(.caption2)
                .fontWeight(isActive ? .semibold : .regular)
                .foregroundStyle(isActive ? .primary : .secondary)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(isActive ? Color.blue.opacity(0.15) : Color.clear)
        )
    }
}

// MARK: - Color Extension for Hex Support

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (1, 1, 1, 0)
        }

        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue:  Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

