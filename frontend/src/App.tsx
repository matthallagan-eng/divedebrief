import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Logbook from "./pages/Logbook";
import DiveDetail from "./pages/DiveDetail";
import Upload from "./pages/Upload";

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Logbook />} />
          <Route path="/dives/:id" element={<DiveDetail />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
