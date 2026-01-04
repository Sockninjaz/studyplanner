import Link from 'next/link';

const Header = () => {
  return (
    <header className="sticky top-0 z-10 flex w-full bg-white drop-shadow-md">
      <div className="flex flex-grow items-center justify-between px-4 py-4 shadow-2 md:px-6 2xl:px-11">
        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/">
            <h1 className="text-2xl font-bold">Study Planner</h1>
          </Link>
        </div>

        <div className="flex items-center gap-3 2xsm:gap-7">
          {/* <!-- User Area --> */}
          <div>User Menu</div>
          {/* <!-- User Area --> */}
        </div>
      </div>
    </header>
  );
};

export default Header;
