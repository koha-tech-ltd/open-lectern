import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import App from '@/App';
import { I18nProvider } from '@/i18n/I18nProvider';
import { GuidePage } from '@/pages/GuidePage';
import { LandingPage } from '@/pages/LandingPage';
import { LegalPage } from '@/pages/LegalPage';
import '@/lib/webmcp-polyfill';
import { installLecternAmdpWindow } from '@/lib/amdp-lectern';
import '@/styles/index.css';

installLecternAmdpWindow();

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element #root not found');
}

createRoot(root).render(
  <StrictMode>
    <I18nProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/studio" element={<App />} />
          <Route path="/license" element={<LegalPage />} />
          <Route path="/privacy" element={<LegalPage />} />
          <Route path="/terms" element={<LegalPage />} />
          <Route path="/cookies" element={<LegalPage />} />
          <Route path="/markdown" element={<GuidePage />} />
          <Route path="/math" element={<GuidePage />} />
        </Routes>
      </BrowserRouter>
    </I18nProvider>
  </StrictMode>,
);
