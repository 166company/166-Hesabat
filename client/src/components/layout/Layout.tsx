import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

export default function Layout() {
  return (
    <div className="flex h-screen" style={{ background: '#f0f2f5' }}>
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6" style={{ background: '#f0f2f5' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
