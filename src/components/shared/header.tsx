import Link from 'next/link';

interface HeaderProps {
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

const Header = ({ isSidebarCollapsed = false, onToggleSidebar }: HeaderProps) => {
  return (
    <header className="sticky top-0 z-10 flex w-full bg-neutral-light drop-shadow-md border-b border-neutral-dark border-opacity-20">
      <div className="flex flex-grow items-center justify-between px-4 py-4 shadow-2 md:px-6 2xl:px-11">
        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/">
            <h1 className="text-2xl font-bold text-neutral-dark">Study Planner</h1>
          </Link>
        </div>

        <div className="flex items-center gap-3 2xsm:gap-7">
          {/* Sidebar Toggle Button */}
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="p-2 text-neutral-dark hover:bg-neutral-dark hover:bg-opacity-10 rounded-lg transition-colors"
              title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isSidebarCollapsed ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                )}
              </svg>
            </button>
          )}
          
          {/* <!-- User Area --> */}
          <div className="text-neutral-dark">User Menu</div>
          {/* <!-- User Area --> */}
        </div>
      </div>
    </header>
  );
};

export default Header;
