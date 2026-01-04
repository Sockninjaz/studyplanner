import Link from 'next/link';

const Sidebar = () => {
  return (
    <aside className="absolute left-0 top-0 z-20 flex h-screen w-72 flex-col overflow-y-hidden bg-gray-800 text-white duration-300 ease-linear lg:static lg:translate-x-0">
      <div className="flex items-center justify-between gap-2 px-6 py-5 lg:py-6">
        <Link href="/">
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        </Link>
      </div>

      <div className="no-scrollbar flex flex-col overflow-y-auto duration-300 ease-linear">
        <nav className="mt-5 py-4 px-4 lg:mt-9 lg:px-6">
          <div>
            <h3 className="mb-4 ml-4 text-sm font-semibold text-gray-400">MENU</h3>
            <ul className="mb-6 flex flex-col gap-1.5">
              <li>
                <Link href="/calendar" className="group relative flex items-center gap-2.5 rounded-sm py-2 px-4 font-medium text-gray-300 duration-300 ease-in-out hover:bg-gray-700">
                  Calendar
                </Link>
              </li>
              <li>
                <Link href="/exams" className="group relative flex items-center gap-2.5 rounded-sm py-2 px-4 font-medium text-gray-300 duration-300 ease-in-out hover:bg-gray-700">
                  Exams
                </Link>
              </li>
              <li>
                <Link href="/session" className="group relative flex items-center gap-2.5 rounded-sm py-2 px-4 font-medium text-gray-300 duration-300 ease-in-out hover:bg-gray-700">
                  New Session
                </Link>
              </li>
            </ul>
          </div>
        </nav>
      </div>
    </aside>
  );
};

export default Sidebar;
