'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Page error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-center p-8 bg-gray-900 rounded-lg shadow-xl max-w-md">
        <h2 className="text-2xl font-bold text-red-500 mb-4">
          오류가 발생했습니다
        </h2>
        <p className="text-gray-400 mb-6">
          페이지를 로드하는 중 문제가 발생했습니다. 
          다시 시도해 주세요.
        </p>
        <div className="space-y-3">
          <Button
            onClick={reset}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            다시 시도
          </Button>
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            className="w-full"
          >
            페이지 새로고침
          </Button>
        </div>
        {error.digest && (
          <p className="text-xs text-gray-500 mt-4">
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}