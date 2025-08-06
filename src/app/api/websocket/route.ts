import { NextRequest, NextResponse } from 'next/server';
import { createServer } from 'http';
import { wsServer } from '@/lib/websocket/server';

// WebSocket 서버 초기화 (한 번만 실행)
let isInitialized = false;

export async function GET(request: NextRequest) {
  // 서버 상태 확인 엔드포인트
  const roomId = request.nextUrl.searchParams.get('roomId');
  
  if (roomId) {
    const roomState = wsServer.getRoomState(roomId);
    
    if (roomState) {
      return NextResponse.json({
        success: true,
        room: {
          roomId: roomState.roomId,
          participantCount: roomState.participants.size,
          hasLyrics: !!roomState.currentLyrics,
          isPlaying: roomState.playbackState.isPlaying,
          settings: roomState.settings,
        },
      });
    } else {
      return NextResponse.json(
        { success: false, message: '방을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
  }
  
  // 전체 서버 상태
  return NextResponse.json({
    success: true,
    server: {
      isInitialized,
      roomCount: wsServer.getRoomCount(),
      status: 'running',
    },
  });
}

export async function POST(request: NextRequest) {
  // WebSocket 서버 초기화 (개발 환경용)
  if (!isInitialized && process.env.NODE_ENV === 'development') {
    try {
      // 개발 서버에서는 별도의 HTTP 서버 생성
      const httpServer = createServer();
      const port = process.env.WEBSOCKET_PORT || 3001;
      
      httpServer.listen(port, () => {
        console.log(`WebSocket server listening on port ${port}`);
      });
      
      wsServer.initialize(httpServer);
      isInitialized = true;
      
      return NextResponse.json({
        success: true,
        message: 'WebSocket server initialized',
        port,
      });
    } catch (error) {
      console.error('Failed to initialize WebSocket server:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to initialize WebSocket server' },
        { status: 500 }
      );
    }
  }
  
  return NextResponse.json({
    success: true,
    message: isInitialized ? 'Server already initialized' : 'Server not initialized',
  });
}