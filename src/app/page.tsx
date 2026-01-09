import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">Welcome to Study Planner</h1>
      <p className="mt-4 text-lg text-gray-600">Your AI-assisted study partner.</p>
      
      <div className="mt-8 space-x-4">
        <Link 
          href="/login" 
          className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors"
        >
          Login
        </Link>
        <Link 
          href="/register" 
          className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 transition-colors"
        >
          Register
        </Link>
      </div>
    </main>
  );
}
