import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

export default function Layout() {
  return (
    <div className="flex h-screen" style={{ background: '#f0f4f8' }}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.75)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .page-enter { animation: fadeUp 0.4s ease-out both; }
        .card-modern { background:#fff; border:1px solid #e2e8f0; border-radius:16px; transition:box-shadow 0.2s,transform 0.2s; }
        .card-modern:hover { box-shadow:0 8px 24px rgba(0,0,0,0.08); }
        .btn-primary { font-size:12px; font-weight:600; color:#fff; border:none; border-radius:10px; padding:8px 16px; cursor:pointer; transition:opacity 0.2s,transform 0.1s; }
        .btn-primary:hover { opacity:0.9; transform:translateY(-1px); }
        .btn-primary:disabled { opacity:0.5; cursor:not-allowed; transform:none; }
        .loading-spinner { width:32px; height:32px; border:3px solid #e2e8f0; border-top-color:#3b82f6; border-radius:50%; animation:spin 0.8s linear infinite; }
        .page-hero { border-radius:16px; padding:20px 24px; margin-bottom:20px; display:flex; align-items:center; justify-content:space-between; }
      `}</style>
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6" style={{ background: '#f0f4f8' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
