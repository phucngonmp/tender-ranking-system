import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute, AdminRoute } from './auth/ProtectedRoute';
import { AppLayout } from './layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { TendersPage } from './pages/TendersPage';
import { TenderDetailPage } from './pages/TenderDetailPage';
import { FilePreviewPage } from './pages/FilePreviewPage';
import { SourcesPage } from './pages/SourcesPage';
import { CriteriaProfilesPage } from './pages/CriteriaProfilesPage';
import { UsersPage } from './pages/UsersPage';
import { CrawlJobsPage } from './pages/CrawlJobsPage';
import { ScoringCriteriaPage } from './pages/ScoringCriteriaPage';
import { EmailDigestPage } from './pages/EmailDigestPage';
import { ClosedTenderListPage } from './pages/ClosedTenderListPage';
import { ClosedTenderCrawlJobsPage } from './pages/ClosedTenderCrawlJobsPage';
import { ClosedTenderStatsPage } from './pages/ClosedTenderStatsPage';
import { CompanyCompetitorDashboardPage } from './pages/CompanyCompetitorDashboardPage';
import { TooltipProvider } from '@/components/ui/tooltip';

export function App() {
  return (
    <TooltipProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/tenders" element={<TendersPage />} />
            <Route path="/tenders/:id" element={<TenderDetailPage />} />
            <Route path="/tenders/:id/attachments/:fileId/preview" element={<FilePreviewPage />} />
            <Route path="/closed-tender-list" element={<ClosedTenderListPage />} />
            <Route path="/closed-tender-stats" element={<ClosedTenderStatsPage />} />
            <Route path="/closed-tender-stats/company/:companyKey" element={<CompanyCompetitorDashboardPage />} />

            <Route element={<AdminRoute />}>
              <Route path="/sources" element={<SourcesPage />} />
              <Route path="/criteria-profiles" element={<CriteriaProfilesPage />} />
              <Route path="/scoring-criteria" element={<ScoringCriteriaPage />} />
              <Route path="/email-digest" element={<EmailDigestPage />} />
              <Route path="/closed-tender-crawl-jobs" element={<ClosedTenderCrawlJobsPage />} />
              <Route path="/crawl-jobs" element={<CrawlJobsPage />} />
              <Route path="/users" element={<UsersPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/tenders" replace />} />
        <Route path="*" element={<Navigate to="/tenders" replace />} />
      </Routes>
    </TooltipProvider>
  );
}
