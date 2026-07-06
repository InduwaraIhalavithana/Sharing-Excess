# Sharing Excess - Frontend

A React-based frontend for the Sharing Excess food redistribution platform in Sri Lanka.

## 🚀 Features

- **User Authentication** with email verification
- **Role-based Access** (Donor/Recipient)
- **Food Listing & Request System**
- **Modern UI/UX** with glassmorphic design
- **Responsive Design** for all devices

## 🛠️ Tech Stack

- **React 18** with Vite
- **React Router** for navigation
- **CSS3** with custom styling
- **Bootstrap 5** for responsive components
- **PHP Backend** with MySQL database

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- XAMPP (for backend)
- Git

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone <your-github-repo-url>
cd sharing-excess-frontend
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Development Server
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## 🏗️ Project Structure

```
frontend/
├── src/
│   ├── components/          # Reusable components
│   │   ├── Navbar.jsx      # Navigation bar
│   │   ├── SignupModal.jsx # User registration
│   │   ├── VerificationModal.jsx # Email verification
│   │   └── ...
│   ├── pages/              # Page components
│   │   ├── Home.jsx        # Landing page
│   │   ├── DonorDashboard.jsx
│   │   └── RecipientDashboard.jsx
│   ├── App.jsx             # Main app component
│   ├── main.jsx            # Entry point
│   └── App.css             # Global styles
├── public/                 # Static assets
└── package.json
```

## 👥 Collaboration Branches

### Main Branch
- `main` - Production-ready code

### Development Branches
- `feature/auth-system` - Authentication & verification features
- `feature/dashboard-ui` - Dashboard improvements
- `feature/food-listing` - Food listing & request system

## 🔧 Development Workflow

### For New Features:
1. Create a new branch from `main`
2. Make your changes
3. Test thoroughly
4. Create a Pull Request
5. Get code review
6. Merge to `main`

### Branch Naming Convention:
- `feature/description` - New features
- `bugfix/description` - Bug fixes
- `hotfix/description` - Urgent fixes

## 📧 Email Verification Setup

The app uses Gmail SMTP for email verification:

1. **Backend Configuration** (in `backend/Mailer.php`):
   - Gmail SMTP: `smtp.gmail.com`
   - Port: `465` (SSL)
   - App Password required

2. **Testing**:
   - Use real Gmail addresses for testing
   - Check spam folder for verification emails

## 🎨 Styling Guidelines

- Use CSS custom properties for colors
- Follow BEM methodology for class naming
- Maintain responsive design principles
- Use glassmorphic effects for modals

## 🐛 Common Issues

### React App Not Starting
```bash
# Kill existing processes
taskkill /f /im node.exe
# Clear cache
npm cache clean --force
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Backend Connection Issues
- Ensure XAMPP is running (Apache + MySQL)
- Check backend URL in fetch calls
- Verify CORS headers in PHP files

## 📝 Contributing

1. **Fork** the repository
2. **Create** a feature branch
3. **Commit** your changes
4. **Push** to your branch
5. **Create** a Pull Request

## 📞 Support

For questions or issues:
- Create an issue on GitHub
- Contact the development team
- Check the backend documentation

## 📄 License

This project is licensed under the MIT License.

---

**Happy Coding! 🎉**
