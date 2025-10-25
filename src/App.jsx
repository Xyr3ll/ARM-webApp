import './App.css';
import { Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import CurriculumOverview from './pages/Curriculum/CurriculumOverview';
import Home from './pages/Dashboard/Home';
import ProgramHeadHome from './pages/Dashboard/ProgramHeadHome';
import FacultyLoading from './pages/Dashboard/FacultyLoading';
import AddFaculty from './pages/Dashboard/AddFaculty';
import FacultyScheduling from './pages/Dashboard/FacultyScheduling';
import ProfessorAssignment from './pages/Dashboard/ProfessorAssignment';
import AddCurriculum from './pages/Curriculum/AddCurriculum';
import CreateSchedule from './pages/Schedule/CreateSchedule';
import ScheduleOverview from './pages/Schedule/ScheduleOverview';
import ArchivedClassSchedule from './pages/Schedule/ArchivedClassSchedule';
import ArchivedCurriculum from './pages/Curriculum/ArchivedCurriculum';
import AcademicHeadDashboard from './pages/Dashboard/AcademicHeadDashboard';
import ProgramHeadDashboard from './pages/Dashboard/ProgramHeadDashboard';
import Substitution from './pages/Substitute/Substitution';
import FacultyArchive from './pages/Dashboard/FacultyArchive';
import Reservations from './pages/Reservations/Reservations';
import ApproveUser from './pages/Dashboard/ApproveUser';

function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/dashboard/academic-head" element={<AcademicHeadDashboard />}>
        <Route index element={<Home />} />
        <Route path="curriculum" element={<CurriculumOverview />} />
        <Route path="curriculum/add" element={<AddCurriculum />} />
        <Route path="create-schedule" element={<CreateSchedule />} />
        <Route path="schedule-overview" element={<ScheduleOverview />} />
        <Route path="archived-class-schedule" element={<ArchivedClassSchedule />} />
        <Route path="curriculum-archive" element={<ArchivedCurriculum />} />
      </Route>
      <Route path="/dashboard/program-head" element={<ProgramHeadDashboard />}>
        <Route index element={<ProgramHeadHome />} />
        <Route path="faculty-scheduling" element={<FacultyScheduling />} />
        <Route path="faculty-scheduling/professor-assignment" element={<ProfessorAssignment />} />
        <Route path="faculty-loading" element={<FacultyLoading />} />
        <Route path="faculty-loading/add" element={<AddFaculty />} />
        <Route path="create-schedule" element={<CreateSchedule />} />
        <Route path="schedule-overview" element={<ScheduleOverview />} />
        <Route path="archived-class-schedule" element={<ArchivedClassSchedule />} />
        <Route path="faculty-archive" element={<FacultyArchive />} />
        <Route path="reservations" element={<Reservations />} />
  <Route path="approve-user" element={<ApproveUser />} />
        <Route path="substitution" element={<Substitution />} />

      </Route>
    </Routes>
  );
}

export default App;
