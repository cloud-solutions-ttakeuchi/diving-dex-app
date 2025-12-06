import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { SpotDetail } from './pages/SpotDetail';
import { CreatureDetailPage } from './pages/CreatureDetailPage';
import { MyPage } from './pages/MyPage';
import { MyPointDetail } from './pages/MyPointDetail';
import { Pokedex } from './pages/Pokedex';
import { AddCreaturePage } from './pages/AddCreaturePage';
import { AddPointPage } from './pages/AddPointPage';
import { AddLogPage } from './pages/AddLogPage';
import { PointSearchPage } from './pages/PointSearchPage';
import { PointDetailPage } from './pages/PointDetailPage';
import { EditLogPage } from './pages/EditLogPage';
import { EditCreaturePage } from './pages/EditCreaturePage';
import { EditPointPage } from './pages/EditPointPage';
import { ProposeCreaturePage } from './pages/ProposeCreaturePage';
import { ProposePointPage } from './pages/ProposePointPage';
import { AdminProposalsPage } from './pages/AdminProposalsPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { AdminAreaCleansingPage } from './pages/AdminAreaCleansingPage';
import { PublicLogsPage } from './pages/PublicLogsPage';
import { LanguageProvider } from './context/LanguageContext';

function App() {
  return (
    <Router>
      <AppProvider>
        <LanguageProvider>
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/pokedex" element={<Pokedex />} />
              <Route path="/spot/:id" element={<SpotDetail />} />
              <Route path="/creature/:id" element={<CreatureDetailPage />} />
              <Route path="/mypage" element={<MyPage />} />
              <Route path="/mypage/point/:id" element={<MyPointDetail />} />
              <Route path="/add-creature" element={<AddCreaturePage />} />
              <Route path="/add-point" element={<AddPointPage />} />
              <Route path="/add-log" element={<AddLogPage />} />
              <Route path="/edit-log/:id" element={<EditLogPage />} />
              <Route path="/edit-creature/:id" element={<EditCreaturePage />} />
              <Route path="/edit-point/:id" element={<EditPointPage />} />
              <Route path="/propose-creature" element={<ProposeCreaturePage />} />
              <Route path="/propose-point" element={<ProposePointPage />} />
              <Route path="/admin/proposals" element={<AdminProposalsPage />} />
              <Route path="/admin/users" element={<AdminUsersPage />} />
              <Route path="/admin/areas" element={<AdminAreaCleansingPage />} />
              <Route path="/points" element={<PointSearchPage />} />
              <Route path="/logs" element={<PublicLogsPage />} />
              <Route path="/point/:id" element={<PointDetailPage />} />
            </Routes>
          </Layout>
        </LanguageProvider>
      </AppProvider>
    </Router>
  );
}

export default App;
