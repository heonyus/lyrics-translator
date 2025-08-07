import { NextRequest, NextResponse } from 'next/server';

// 허용된 비밀번호 목록 (환경 변수로 관리하거나 하드코딩)
const ALLOWED_PASSWORDS = process.env.ALLOWED_PASSWORDS?.split(',') || [
  'heonyus2025',  // 기본 비밀번호
  'admin123',     // 관리자용
  'guest2025'     // 게스트용
];

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();
    
    if (!password) {
      return NextResponse.json(
        { success: false, error: '비밀번호를 입력해주세요' },
        { status: 400 }
      );
    }
    
    // 비밀번호 확인
    if (ALLOWED_PASSWORDS.includes(password)) {
      // 쿠키 설정
      const response = NextResponse.json({ success: true });
      response.cookies.set('auth', password, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 30, // 30일
        path: '/'
      });
      
      return response;
    } else {
      return NextResponse.json(
        { success: false, error: '비밀번호가 올바르지 않습니다' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}