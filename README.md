# 🏥 MedTrack - Comprehensive Medication Tracking App

A modern, responsive web application built with React and TypeScript for tracking medications, managing schedules, and monitoring adherence.

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

### ⚙️ Advanced Features
- **Data Export/Import**: JSON and CSV export with backup/restore functionality
- **User Profiles**: Personal information, allergies, medical conditions
- **Emergency Contacts**: Store important contact information
- **Customizable Settings**: Themes, notifications, display preferences
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices

## 🚀 Getting Started

### Prerequisites
- Node.js 16.0 or higher
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/MedTrack.git
   cd MedTrack
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

### Quick Start
For first-time users:
1. Add your first medication using the "Add Medication" button
2. Set up reminders for consistent tracking
3. Explore the dashboard to monitor your adherence
4. Use the calendar view to see your medication schedule

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
The application uses client-side storage by default. For production deployments, you may want to configure:
- API endpoints (if adding backend integration)
- Analytics tracking IDs
- Notification service keys

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
- Optional anonymous usage analytics
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

This project is licensed under the MIT License - see the LICENSE file for details.

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
- PWA (Progressive Web App) capabilities
- Offline functionality with service workers
- Enhanced accessibility features
- Advanced data visualization options

---

## 🚀 Deployment

### GitHub Pages
This project is configured for automatic deployment to GitHub Pages:

1. Fork the repository
2. Enable GitHub Pages in repository settings
3. Push to the `main` branch to trigger deployment
4. Your app will be available at `https://your-username.github.io/MedTrack/`

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
