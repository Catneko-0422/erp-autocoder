import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900">404</h1>
        <p className="text-gray-500 mt-2">找不到頁面。</p>
        <Link to="/" className="inline-block mt-4 text-sm text-blue-600 hover:underline">回首頁</Link>
      </div>
    </div>
  );
}
