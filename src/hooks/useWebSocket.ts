"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useNeonToast } from '@/components/design-system';

export interface WebSocketState {
  isConnected: boolean;
  roomId: string | null;
  isHost: boolean;
  participants: Map<string, any>;
  currentLyrics: any | null;
  playbackState: {
    isPlaying: boolean;
    currentLineIndex: number;
    currentWordIndex: number;
    timestamp: number;
    playbackSpeed: number;
  };
  settings: {
    targetLanguage: string;
    showOriginal: boolean;
    showTranslation: boolean;
    fontSize: 'small' | 'medium' | 'large' | 'xl';
    theme: 'dark' | 'light' | 'neon';
  };
  messages: Array<{
    from: string;
    message: string;
    timestamp: Date;
  }>;
}

export const useWebSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { success, error, info } = useNeonToast();
  
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    roomId: null,
    isHost: false,
    participants: new Map(),
    currentLyrics: null,
    playbackState: {
      isPlaying: false,
      currentLineIndex: 0,
      currentWordIndex: 0,
      timestamp: 0,
      playbackSpeed: 1,
    },
    settings: {
      targetLanguage: 'en',
      showOriginal: true,
      showTranslation: true,
      fontSize: 'medium',
      theme: 'neon',
    },
    messages: [],
  });

  // 연결 초기화
  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      console.log('Already connected to WebSocket');
      return;
    }

    const socketUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:3001';
    
    socketRef.current = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    const socket = socketRef.current;

    // 연결 이벤트
    socket.on('connect', () => {
      console.log('Connected to WebSocket server');
      setState(prev => ({ ...prev, isConnected: true }));
      success('서버 연결됨', '실시간 동기화가 활성화되었습니다.');
      
      // 하트비트 시작
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      heartbeatIntervalRef.current = setInterval(() => {
        socket.emit('heartbeat');
      }, 30000); // 30초마다
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
      setState(prev => ({ ...prev, isConnected: false }));
      error('연결 끊김', '서버와의 연결이 끊어졌습니다.');
      
      // 하트비트 중지
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    });

    // 방 생성 완료
    socket.on('room_created', ({ roomId, roomState }) => {
      setState(prev => ({
        ...prev,
        roomId,
        isHost: true,
        participants: new Map(roomState.participants),
        currentLyrics: roomState.currentLyrics,
        playbackState: roomState.playbackState,
        settings: roomState.settings,
      }));
      success('방 생성됨', `방 코드: ${roomId}`);
    });

    // 방 참가 완료
    socket.on('room_joined', ({ roomState }) => {
      setState(prev => ({
        ...prev,
        roomId: roomState.roomId,
        isHost: false,
        participants: new Map(roomState.participants),
        currentLyrics: roomState.currentLyrics,
        playbackState: roomState.playbackState,
        settings: roomState.settings,
      }));
      success('방 참가됨', '실시간 동기화가 시작되었습니다.');
    });

    // 참가자 입장
    socket.on('participant_joined', ({ participant }) => {
      setState(prev => {
        const newParticipants = new Map(prev.participants);
        newParticipants.set(participant.id, participant);
        return { ...prev, participants: newParticipants };
      });
      info('새 참가자', `${participant.nickname}님이 입장했습니다.`);
    });

    // 참가자 퇴장
    socket.on('participant_left', ({ participantId, nickname }) => {
      setState(prev => {
        const newParticipants = new Map(prev.participants);
        newParticipants.delete(participantId);
        return { ...prev, participants: newParticipants };
      });
      info('참가자 퇴장', `${nickname}님이 퇴장했습니다.`);
    });

    // 재생 상태 업데이트
    socket.on('playback_updated', ({ playbackState }) => {
      setState(prev => ({ ...prev, playbackState }));
    });

    // 가사 변경
    socket.on('lyrics_changed', ({ lyrics, playbackState }) => {
      setState(prev => ({
        ...prev,
        currentLyrics: lyrics,
        playbackState,
      }));
      info('가사 변경', `${lyrics.title} - ${lyrics.artist}`);
    });

    // 설정 업데이트
    socket.on('settings_updated', ({ settings }) => {
      setState(prev => ({ ...prev, settings }));
    });

    // 메시지 수신
    socket.on('message_received', ({ from, message, timestamp }) => {
      setState(prev => ({
        ...prev,
        messages: [...prev.messages, { from, message, timestamp }].slice(-100), // 최대 100개 메시지 유지
      }));
    });

    // 방 종료
    socket.on('room_closed', ({ reason }) => {
      setState(prev => ({
        ...prev,
        roomId: null,
        isHost: false,
        participants: new Map(),
        currentLyrics: null,
        messages: [],
      }));
      error('방 종료', reason);
    });

    // 에러 처리
    socket.on('error', ({ message }) => {
      error('오류', message);
    });

    // 하트비트 응답
    socket.on('heartbeat_ack', () => {
      console.log('Heartbeat acknowledged');
    });
  }, [success, error, info]);

  // 연결 해제
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    
    setState({
      isConnected: false,
      roomId: null,
      isHost: false,
      participants: new Map(),
      currentLyrics: null,
      playbackState: {
        isPlaying: false,
        currentLineIndex: 0,
        currentWordIndex: 0,
        timestamp: 0,
        playbackSpeed: 1,
      },
      settings: {
        targetLanguage: 'en',
        showOriginal: true,
        showTranslation: true,
        fontSize: 'medium',
        theme: 'neon',
      },
      messages: [],
    });
  }, []);

  // 방 생성
  const createRoom = useCallback((hostId: string, nickname: string, lyricsId?: string) => {
    if (!socketRef.current?.connected) {
      error('연결 오류', '서버에 연결되지 않았습니다.');
      return;
    }
    
    socketRef.current.emit('create_room', {
      hostId,
      nickname,
      lyricsId,
    });
  }, [error]);

  // 방 참가
  const joinRoom = useCallback((roomId: string, nickname: string, preferredLanguage?: string) => {
    if (!socketRef.current?.connected) {
      error('연결 오류', '서버에 연결되지 않았습니다.');
      return;
    }
    
    socketRef.current.emit('join_room', {
      roomId,
      nickname,
      preferredLanguage,
    });
  }, [error]);

  // 재생 상태 동기화
  const syncPlayback = useCallback((playbackState: WebSocketState['playbackState']) => {
    if (!socketRef.current?.connected || !state.roomId) {
      return;
    }
    
    socketRef.current.emit('sync_playback', {
      roomId: state.roomId,
      playbackState,
    });
  }, [state.roomId]);

  // 가사 변경
  const changeLyrics = useCallback((lyricsId: string) => {
    if (!socketRef.current?.connected || !state.roomId) {
      return;
    }
    
    socketRef.current.emit('change_lyrics', {
      roomId: state.roomId,
      lyricsId,
    });
  }, [state.roomId]);

  // 설정 업데이트
  const updateSettings = useCallback((settings: Partial<WebSocketState['settings']>) => {
    if (!socketRef.current?.connected || !state.roomId) {
      return;
    }
    
    socketRef.current.emit('update_settings', {
      roomId: state.roomId,
      settings,
    });
  }, [state.roomId]);

  // 메시지 전송
  const sendMessage = useCallback((message: string) => {
    if (!socketRef.current?.connected || !state.roomId) {
      return;
    }
    
    socketRef.current.emit('send_message', {
      roomId: state.roomId,
      message,
    });
  }, [state.roomId]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    state,
    connect,
    disconnect,
    createRoom,
    joinRoom,
    syncPlayback,
    changeLyrics,
    updateSettings,
    sendMessage,
  };
};