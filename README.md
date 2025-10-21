# ARM Admin Dashboard

Academic Resource Management System - Admin Dashboard

A comprehensive web application for managing academic resources, faculty schedules, curriculum, and reservations for STI College.

## Project Structure

```
admin-dashboard/
├── public/              # Static assets
│   ├── background.jpg
│   ├── sti-logo.png
│   └── vite.svg
├── src/
│   ├── assets/         # Images, icons, fonts
│   │   ├── login-background.jpg
│   │   └── stilogo.png
│   ├── data/           # Static data
│   │   └── accounts.js
│   ├── pages/          # Page components
│   │   ├── Curriculum/
│   │   │   ├── CurriculumOverview.jsx
│   │   │   ├── AddCurriculum.jsx
│   │   │   ├── ArchivedCurriculum.jsx
│   │   │   └── Curriculum.css
│   │   ├── Dashboard/
│   │   │   ├── AcademicHeadDashboard.jsx
│   │   │   ├── ProgramHeadDashboard.jsx
│   │   │   ├── Home.jsx
│   │   │   ├── ProgramHeadHome.jsx
│   │   │   ├── FacultyLoading.jsx
│   │   │   ├── FacultyScheduling.jsx
│   │   │   ├── AddFaculty.jsx
│   │   │   ├── FacultyArchive.jsx
│   │   │   └── ProfessorAssignment.jsx
│   │   ├── Schedule/
│   │   │   ├── ScheduleOverview.jsx
│   │   │   ├── CreateSchedule.jsx
│   │   │   ├── FullScheduleEditor.jsx
│   │   │   ├── ViewScheduleEditor.jsx
│   │   │   ├── ArchivedClassSchedule.jsx
│   │   │   └── Schedule.css
│   │   ├── Reservations/
│   │   │   ├── Reservations.jsx
│   │   │   └── Reservations.css
│   │   ├── Substitute/
│   │   │   └── Substitution.jsx
│   │   └── LoginPage.jsx
│   ├── styles/         # Global CSS files
│   │   ├── AcademicHeadDashboard.css
│   │   └── LoginPage.css
│   ├── firebase.js     # Firebase configuration
│   ├── App.jsx         # Main app component with routing
│   ├── App.css         # App styles
│   ├── main.jsx        # Entry point
│   └── index.css       # Global styles
├── .env                # Environment variables (not tracked)
├── .env.example        # Environment variables template
├── .gitignore
├── package.json
├── vite.config.js
└── README.md
```

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Firebase account

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Xyr3ll/ARM-webApp.git
cd admin-dashboard
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
# Copy the example env file
cp .env.example .env

# Edit .env and add your Firebase credentials
```

4. Start development server:
```bash
npm run dev
```

5. Build for production:
```bash
npm run build
```

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain_here
VITE_FIREBASE_PROJECT_ID=your_project_id_here
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket_here
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id_here
VITE_FIREBASE_APP_ID=your_app_id_here
```

## Features

### 🔐 Authentication
- Secure login system with role-based access
- Academic Head and Program Head dashboards

### 📚 Curriculum Management
- Create and manage curriculum for BSIT, BSCS, and CPE programs
- Add, edit, and archive curriculum
- Semester-based course organization

### 👨‍🏫 Faculty Management
- Add and manage faculty members
- Track faculty loading (units)
- Support for full-time and part-time faculty
- Overload management
- Faculty archive system

### � Schedule Management
- Interactive drag-and-drop schedule editor
- Automatic room conflict detection
- Support for lecture, laboratory, and P.E. rooms
- Multi-section schedule viewing
- Archive old schedules

### 🔄 Faculty Substitution
- Assign substitute teachers
- Automatic conflict detection
- Qualified faculty filtering based on courses

### 📝 Room Reservations
- View and manage room reservation requests
- Approve or decline reservations
- Real-time updates from Firestore

### 🗄️ Archive System
- Archive faculty, schedules, and curriculum
- Separate view for archived items
- Restore capability

## Technologies

- **Frontend**: React 19
- **Build Tool**: Vite 7
- **Database**: Firebase Firestore
- **Routing**: React Router v6
- **Icons**: React Icons (HeroIcons v2)
- **Styling**: CSS3 with custom designs
- **State Management**: React Hooks

## Firebase Collections

The app uses the following Firestore collections:
- `users` - User accounts and authentication
- `faculty` - Faculty members and their courses
- `curriculum` - Course curriculum for each program
- `schedules` - Section schedules and room assignments
- `reservations` - Room reservation requests

## Development Guidelines

### Room Types
- **Lecture Rooms**: Regular classrooms (ROOM 102, ROOM 301, etc.)
- **Laboratory Rooms**: Computer labs (COMP LAB 101, COMP LAB 601, etc.)
- **P.E. Rooms**: Gym facilities (COURT, PENTHOUSE, GYM, COVERED COURT)

### Faculty Loading Rules
- **Full-time Faculty**: 24 units (regular), up to 30 units (with overload)
- **Part-time Faculty**: Maximum 15 units (no overload allowed)

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is proprietary software developed for STI College.

## Contact

Project Developer: Xyrell
- GitHub: [@Xyr3ll](https://github.com/Xyr3ll)
- Repository: [ARM-webApp](https://github.com/Xyr3ll/ARM-webApp)

---

**Note**: Remember to keep your `.env` file secure and never commit it to version control.
