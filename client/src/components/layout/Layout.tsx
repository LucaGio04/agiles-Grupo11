import { Outlet } from 'react-router';
import { Navbar } from './Navbar.tsx';

export function Layout() {
  return (
    <>
      <Navbar />
      <main className="page">
        <Outlet />
      </main>
    </>
  );
}
