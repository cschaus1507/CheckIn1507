import { Routes, Route, Navigate } from "react-router-dom";
import Nav from "./components/Nav.jsx";
import StudentUI from "./pages/StudentUI.jsx";
import MentorUI from "./pages/MentorUI.jsx";
import MentorStudent from "./pages/MentorStudent.jsx";
import Manage from "./pages/Manage.jsx";
import Tasks from "./pages/Tasks.jsx";

export default function App() {
  return (
    <div className="min-h-screen text-white lightning-bg">
      <Nav />
      <div className="max-w-6xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<StudentUI />} />
          <Route path="/mentor" element={<MentorUI />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/mentor/student/:id" element={<MentorStudent />} />
          <Route path="/manage" element={<Manage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}
