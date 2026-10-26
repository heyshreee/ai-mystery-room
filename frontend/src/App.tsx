import { Routes, Route } from "react-router-dom";
import { Layout } from "./app/Layout";
import { LandingPage } from "./pages/LandingPage";
import { CreateCasePage } from "./pages/CreateCasePage";
import { SamplePage } from "./pages/SamplePage";
import { InvestigationPage } from "./pages/InvestigationPage";
import { ResultsPage } from "./pages/ResultsPage";
import { NotFoundPage } from "./pages/NotFoundPage";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<LandingPage />} />
        <Route path="create" element={<CreateCasePage />} />
        <Route path="sample" element={<SamplePage />} />
        <Route path="case/:caseId" element={<InvestigationPage />} />
        <Route path="case/:caseId/results/:sessionId" element={<ResultsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
