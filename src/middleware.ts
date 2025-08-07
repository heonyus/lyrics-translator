import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 허용된 사용자 목록 (환경 변수로 관리)
const ALLOWED_PASSWORDS = process.env.ALLOWED_PASSWORDS?.split(',') || ['heonyus2025'];

export function middleware(request: NextRequest) {
  // API 경로는 제외
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // 정적 파일은 제외
  if (
    request.nextUrl.pathname.startsWith('/_next') ||
    request.nextUrl.pathname.startsWith('/favicon.ico')
  ) {
    return NextResponse.next();
  }

  // 인증 체크
  const auth = request.cookies.get('auth');
  
  if (!auth || !ALLOWED_PASSWORDS.includes(auth.value)) {
    // 로그인 페이지로 리다이렉트
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - /api (API routes)
     * - /_next (Next.js internals)
     * - /favicon.ico (favicon file)
     * - /login (login page)
     */
    '/((?!api|_next|favicon.ico|login).*)',
  ],
};