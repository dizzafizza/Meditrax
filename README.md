<a href="https://www.buymeacoffee.com/dizzafizza" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

# 🏥 Meditrax - Comprehensive Medication Tracking App

A modern, responsive web application built with React and TypeScript for tracking medications, managing schedules, and monitoring adherence.

## 🐞🔧 Known Notes:
- **Tapering System:** Sometimes you may get an incorrect dosage. *WIP*
- **iOS PWA Push Notifications:** Fully supported via Web Push (VAPID) and/or FCM once environment variables are configured. See "Web Push (iOS/ Safari) and FCM Setup" below. If env keys are missing, the app falls back to local SW scheduling with missed‑dose recovery.
- **App Doesn't Update Properly:** Previous versions may be loaded from cache; refresh or clear cache to update to the latest version.

## ✨ Features

### 📋 Medication Management
- **Add Custom Medications**: Create entries for any medication with detailed information
- **Pre-categorized Types**: Prescription, OTC, supplements, vitamins, herbal, injections, topicals, emergency
- **Comprehensive Details**: Dosage, frequency, notes, side effects, drug interactions
- **Inventory Tracking**: Monitor pills remaining with refill reminders
- **Color Coding**: Visual organization with customizable medication colors

### 🗓️ Scheduling & Reminders
- **Flexible Scheduling**: Daily, weekly, custom frequencies, or as-needed
- **Smart Reminders**: Customizable notification times with advance warnings
- **Calendar Views**: Week and month views with medication schedules
- **Quick Actions**: Mark medications as taken or missed directly from reminders

### 📊 Analytics & Insights
- **Adherence Tracking**: Detailed percentage-based adherence monitoring
- **Visual Charts**: Line charts, bar charts, and pie charts for data visualization
- **Medication Reports**: Individual and overall medication performance
- **Trend Analysis**: Track improvement or decline in adherence over time
- **Date Range Filtering**: 7-day, 30-day, and 90-day analysis periods

### 📱 Progressive Web App (PWA) Features
- **Mobile Installation**: Install as a native-like app on iOS, Android, and desktop
- **Offline Functionality**: Use the app without internet connection
- **Push Notifications**: Receive medication reminders even when the app is closed
- **Background Sync**: Data syncs automatically when connection is restored
- **Fast Loading**: Cached resources for instant app startup
- **Native Integration**: Home screen shortcuts and app-like experience

### 🔔 Smart Notifications
- **Cross-Platform Push**: Works on iOS, Android, and desktop browsers
- **Interactive Notifications**: Mark as taken, snooze, or skip directly from notifications
- **Smart Scheduling**: Automatic notification scheduling based on medication schedules
- **Permission Management**: Easy notification permission setup and testing
- **Offline Reminders**: Local notifications work even without internet

### ⚙️ Advanced Features
- **Data Export/Import**: JSON and CSV export with backup/restore functionality
- **User Profiles**: Personal information, allergies, medical conditions
- **Emergency Contacts**: Store important contact information
- **Customizable Settings**: Themes, notifications, display preferences, PWA options
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices

## 🚀 Getting Started

### Prerequisites
- Node.js 16.0 or higher
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/Meditrax.git
   cd Meditrax
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:3000` to view the application.

### PWA Installation

Meditrax can be installed as a Progressive Web App for the best mobile experience:

**On Mobile (iOS/Android):**
1. Open the app in your browser (Safari on iOS, Chrome on Android)
2. Look for "Add to Home Screen" or "Install App" option
3. Follow the prompts to install
4. Access the app from your home screen like any native app

**On Desktop:**
1. Open the app in Chrome, Edge, or Safari
2. Look for the install icon in the address bar
3. Click "Install" to add to your desktop/applications
4. Launch like any desktop application

**Benefits of PWA Installation:**
- Receive push notifications for medication reminders
- Works offline with cached data
- Faster loading and app-like experience
- Integrates with your device's notification system

#### iOS Offline Usage Notes
- Open the app once while online after installing to allow the service worker to fully install and cache the app shell.
- After that, you can launch the app from the Home Screen with no connectivity.
- If you see a blank page when completely offline, force close and relaunch; iOS can be aggressive about suspending service workers.
- The app now avoids loading optional scripts during service worker startup to ensure offline launch reliability on iOS.

### Quick Start
For first-time users:
1. **Enable Notifications**: Go to Settings → Notifications and enable push notifications
2. **Install as PWA**: Install the app on your device for the best experience
3. **Add Medications**: Use the "Add Medication" button to create your first entries
4. **Set Up Reminders**: Configure notification schedules for each medication
5. **Test Notifications**: Use the test button in settings to verify notifications work
6. **Explore Dashboard**: Monitor your adherence and upcoming doses
7. **Calendar View**: See your complete medication schedule
8. **Advanced Features**: Explore Cyclic Dosing for complex schedules

### Building for Production

```bash
npm run build
# or
yarn build
```

The production build will be available in the `dist` directory.

## 🛠️ Technology Stack

### Frontend Framework
- **React 18** - Modern React with hooks and concurrent features
- **TypeScript** - Type-safe development with IntelliSense
- **Vite** - Fast build tool with HMR (Hot Module Replacement)

### State Management
- **Zustand** - Lightweight state management with persistence
- **React Hook Form** - Performant form handling with validation

### UI & Styling
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Beautiful, customizable icons
- **Recharts** - Responsive chart library for data visualization
- **React Hot Toast** - Elegant toast notifications

### Data & Storage
- **LocalStorage** - Client-side data persistence
- **date-fns** - Modern date utility library
- **CSV Export** - Data export functionality

### Development Tools
- **ESLint** - Code linting and style enforcement
- **TypeScript** - Static type checking
- **PostCSS** - CSS processing with Autoprefixer

## 📱 Application Structure

```
src/
├── components/          # Reusable UI components
│   ├── layout/         # Layout components (Header, Sidebar, Layout)
│   ├── modals/         # Modal dialogs (MedicationModal)
│   └── ui/             # Basic UI components (ConfirmDialog)
├── pages/              # Main application pages
│   ├── Dashboard.tsx   # Overview and quick actions
│   ├── Medications.tsx # Medication management
│   ├── Calendar.tsx    # Schedule and calendar view
│   ├── Analytics.tsx   # Charts and adherence tracking
│   └── Settings.tsx    # User preferences and data management
├── store/              # Zustand state management
├── types/              # TypeScript type definitions
├── utils/              # Utility functions and helpers
└── styles/             # Global styles and Tailwind config
```

## 🔧 Configuration

### Environment Variables
The application uses client-side storage by default. For production deployments, configure:
- API endpoints (if adding backend integration)
- Analytics tracking IDs
- Notification service keys

#### Web Push (iOS/ Safari) and FCM Setup

To deliver notifications reliably on iOS PWAs, enable standard Web Push alongside FCM:

1) Get VAPID keys (one-time):
- Recommended: In Firebase Console → Project Settings → Cloud Messaging → Web Push certificates, click "Generate key pair". Copy both Public and Private keys.
- Or generate your own pair:
```bash
npx web-push generate-vapid-keys
```
Either pair works for standard Web Push and FCM Web; reusing Firebase’s pair keeps one set of keys.

2) Configure Cloud Functions secrets (preferred) or env vars:
```bash
# Using Firebase Functions config
firebase functions:config:set webpush.vapid_public_key="<PUBLIC_KEY>" webpush.vapid_private_key="<PRIVATE_KEY>" webpush.contact_email="mailto:notifications@meditrax.ca"

# Or set env for local emulators
export WEB_PUSH_VAPID_PUBLIC_KEY="<PUBLIC_KEY>"
export WEB_PUSH_VAPID_PRIVATE_KEY="<PRIVATE_KEY>"
export WEB_PUSH_CONTACT_EMAIL="mailto:notifications@meditrax.ca"
```

3) Frontend env (.env):
```bash
# Firebase (used for FCM + callable functions)
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...

# Web Push VAPID public key used for PushManager.subscribe
# You can re-use the same PUBLIC key as above
VITE_FIREBASE_VAPID_KEY=<PUBLIC_KEY>

# Optional gates to enable background features
# Enable initializing Firebase Messaging inside the service worker (prod recommended)
VITE_ENABLE_SW_FIREBASE=true
# Enable anonymous Firebase Auth for backend scheduling (optional)
VITE_ENABLE_BACKEND_AUTH=true
```

4) Deploy functions after setting config:
```bash
cd functions && npm run deploy
```

Notes:
- FCM may not deliver to iOS Safari PWAs on some versions. Web Push ensures delivery on iOS (iOS 16.4+ and installed to Home Screen).
- The app will use FCM where supported (Android/desktop Chromium) and Web Push where needed (iOS/Safari).

### Customization
- **Colors**: Modify `tailwind.config.js` for brand colors
- **Themes**: Extend theme options in the settings page
- **Medication Categories**: Update `types/index.ts` for custom categories

## 🎯 Usage Guide

### Getting Started
1. **Create Your Profile**: Add your name and medical information in Settings
2. **Add Medications**: Use the "Add Medication" button to create your first entries
3. **Set Reminders**: Configure notification schedules for each medication
4. **Track Adherence**: Mark medications as taken or missed from the dashboard
5. **Monitor Progress**: Review analytics to track your adherence trends

### Best Practices
- **Regular Updates**: Log medications promptly for accurate tracking
- **Backup Data**: Export your data regularly for safekeeping
- **Review Analytics**: Check weekly adherence reports to identify patterns
- **Emergency Info**: Keep emergency contacts and allergy information updated

## 🔒 Privacy & Security

### Data Storage
- All data is stored locally in your browser
- No personal information is transmitted to external servers
- Export/import functionality allows full data control

### Privacy Features
- ~Optional anonymous usage analytics~> Disabled
- Local-only storage with no cloud sync by default
- Comprehensive data deletion options

## 🤝 Contributing

We welcome contributions! Please see our [contributing guidelines](CONTRIBUTING.md) for details on:
- Code style and conventions
- Pull request process
- Issue reporting
- Feature requests

### Development Setup
1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Submit a pull request with a clear description

### Code Style
- Use TypeScript strict mode
- Follow the existing component patterns
- Write meaningful commit messages
- Add tests for new features

## 📄 License

This project is licensed under the GPL-3.0 License - see the LICENSE file for details.

## 🆘 Support

### Common Issues
- **Notifications not working**: Check browser notification permissions
- **Data loss**: Regular exports are recommended for backup
- **Mobile display**: Fully responsive design optimized for all screen sizes
- **Performance**: Clear browser cache if experiencing slow loading

### Getting Help
- Review the in-app help sections
- Check browser console for error messages
- Ensure JavaScript is enabled
- Try clearing browser cache if experiencing issues

## 🔮 Future Enhancements

### Planned Features
- **Backend Integration**: Cloud sync and multi-device support
- **Healthcare Provider Portal**: Share adherence reports with doctors
- **Advanced Analytics**: Machine learning insights and predictions
- **PWA Support**: Progressive Web App for mobile installation
- **Medication Database**: Integration with drug databases for auto-completion
- **Prescription Scanning**: OCR for automatic medication entry
- **Multi-language Support**: International localization

### Technical Roadmap
- ✅ PWA (Progressive Web App) capabilities
- ✅ Offline functionality with service workers
- ✅ Push notification system for medication reminders
- Enhanced accessibility features
- Advanced data visualization options
- Firebase Cloud Messaging integration (optional)
- Apple Health & Google Fit integration

---

## 🚀 Deployment

### GitHub Pages
This project is configured for automatic deployment to GitHub Pages:

1. Fork the repository
2. Enable GitHub Pages in repository settings
3. Push to the `main` branch to trigger deployment
4. Your app will be available at `https://your-username.github.io/Meditrax/`

### Manual Deployment
For other hosting platforms:

```bash
npm run build
# Upload the contents of the 'dist' folder to your web server
```

## 🏗️ Development Notes

### Project Structure Decisions
- **Component-based Architecture**: Modular, reusable components
- **Type Safety**: Comprehensive TypeScript coverage
- **State Management**: Centralized with Zustand for simplicity
- **Responsive Design**: Mobile-first approach with Tailwind CSS

### Performance Considerations
- **Code Splitting**: Vite handles automatic code splitting
- **Image Optimization**: Lazy loading for medication images
- **State Optimization**: Memoization for expensive calculations
- **Bundle Size**: Tree-shaking and dependency optimization

Built with ❤️ for better health management
