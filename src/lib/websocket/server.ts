import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { supabase } from '@/lib/supabase';

export interface RoomState {
  roomId: string;
  hostId: string;
  participants: Map<string, ParticipantInfo>;
  currentLyrics: {
    id: string;
    title: string;
    artist: string;
    lines: any[];
  } | null;
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
}

export interface ParticipantInfo {
  id: string;
  nickname: string;
  role: 'host' | 'viewer';
  joinedAt: Date;
  isActive: boolean;
  preferredLanguage?: string;
}

class WebSocketServer {
  private io: SocketIOServer | null = null;
  private rooms: Map<string, RoomState> = new Map();
  private userSocketMap: Map<string, string> = new Map(); // socketId -> roomId

  initialize(httpServer: HTTPServer) {
    if (this.io) {
      console.warn('WebSocket server already initialized');
      return;
    }

    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
      },
      transports: ['websocket', 'polling'],
    });

    this.setupEventHandlers();
    console.log('WebSocket server initialized');
  }

  private setupEventHandlers() {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`);

      // 방 생성
      socket.on('create_room', async (data: {
        hostId: string;
        nickname: string;
        lyricsId?: string;
      }) => {
        const roomId = this.generateRoomId();
        const roomState: RoomState = {
          roomId,
          hostId: data.hostId,
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
        };

        // 호스트 추가
        roomState.participants.set(socket.id, {
          id: socket.id,
          nickname: data.nickname,
          role: 'host',
          joinedAt: new Date(),
          isActive: true,
        });

        // 가사 로드
        if (data.lyricsId) {
          const lyrics = await this.loadLyrics(data.lyricsId);
          if (lyrics) {
            roomState.currentLyrics = lyrics;
          }
        }

        this.rooms.set(roomId, roomState);
        this.userSocketMap.set(socket.id, roomId);
        
        socket.join(roomId);
        socket.emit('room_created', {
          roomId,
          roomState,
        });

        console.log(`Room created: ${roomId} by ${data.nickname}`);
      });

      // 방 참가
      socket.on('join_room', async (data: {
        roomId: string;
        nickname: string;
        preferredLanguage?: string;
      }) => {
        const room = this.rooms.get(data.roomId);
        
        if (!room) {
          socket.emit('error', { message: '방을 찾을 수 없습니다.' });
          return;
        }

        // 참가자 추가
        room.participants.set(socket.id, {
          id: socket.id,
          nickname: data.nickname,
          role: 'viewer',
          joinedAt: new Date(),
          isActive: true,
          preferredLanguage: data.preferredLanguage,
        });

        this.userSocketMap.set(socket.id, data.roomId);
        socket.join(data.roomId);

        // 현재 상태 전송
        socket.emit('room_joined', {
          roomState: room,
        });

        // 다른 참가자들에게 알림
        socket.to(data.roomId).emit('participant_joined', {
          participant: room.participants.get(socket.id),
        });

        console.log(`${data.nickname} joined room: ${data.roomId}`);
      });

      // 재생 상태 동기화
      socket.on('sync_playback', (data: {
        roomId: string;
        playbackState: RoomState['playbackState'];
      }) => {
        const room = this.rooms.get(data.roomId);
        if (!room) return;

        const participant = room.participants.get(socket.id);
        if (participant?.role !== 'host') {
          socket.emit('error', { message: '호스트만 재생을 제어할 수 있습니다.' });
          return;
        }

        room.playbackState = data.playbackState;
        
        // 모든 참가자에게 동기화
        this.io?.to(data.roomId).emit('playback_updated', {
          playbackState: room.playbackState,
        });
      });

      // 가사 변경
      socket.on('change_lyrics', async (data: {
        roomId: string;
        lyricsId: string;
      }) => {
        const room = this.rooms.get(data.roomId);
        if (!room) return;

        const participant = room.participants.get(socket.id);
        if (participant?.role !== 'host') {
          socket.emit('error', { message: '호스트만 가사를 변경할 수 있습니다.' });
          return;
        }

        const lyrics = await this.loadLyrics(data.lyricsId);
        if (lyrics) {
          room.currentLyrics = lyrics;
          room.playbackState = {
            isPlaying: false,
            currentLineIndex: 0,
            currentWordIndex: 0,
            timestamp: 0,
            playbackSpeed: 1,
          };

          this.io?.to(data.roomId).emit('lyrics_changed', {
            lyrics: room.currentLyrics,
            playbackState: room.playbackState,
          });
        }
      });

      // 설정 변경
      socket.on('update_settings', (data: {
        roomId: string;
        settings: Partial<RoomState['settings']>;
      }) => {
        const room = this.rooms.get(data.roomId);
        if (!room) return;

        const participant = room.participants.get(socket.id);
        if (participant?.role !== 'host') {
          socket.emit('error', { message: '호스트만 설정을 변경할 수 있습니다.' });
          return;
        }

        room.settings = { ...room.settings, ...data.settings };
        
        this.io?.to(data.roomId).emit('settings_updated', {
          settings: room.settings,
        });
      });

      // 채팅 메시지
      socket.on('send_message', (data: {
        roomId: string;
        message: string;
      }) => {
        const room = this.rooms.get(data.roomId);
        if (!room) return;

        const participant = room.participants.get(socket.id);
        if (!participant) return;

        this.io?.to(data.roomId).emit('message_received', {
          from: participant.nickname,
          message: data.message,
          timestamp: new Date(),
        });
      });

      // 연결 해제
      socket.on('disconnect', () => {
        const roomId = this.userSocketMap.get(socket.id);
        
        if (roomId) {
          const room = this.rooms.get(roomId);
          
          if (room) {
            const participant = room.participants.get(socket.id);
            
            if (participant) {
              // 호스트가 나가면 방 종료
              if (participant.role === 'host') {
                this.io?.to(roomId).emit('room_closed', {
                  reason: '호스트가 방을 나갔습니다.',
                });
                
                // 모든 참가자 제거
                room.participants.forEach((_, socketId) => {
                  this.userSocketMap.delete(socketId);
                });
                
                this.rooms.delete(roomId);
                console.log(`Room ${roomId} closed - host disconnected`);
              } else {
                // 일반 참가자 제거
                room.participants.delete(socket.id);
                socket.to(roomId).emit('participant_left', {
                  participantId: socket.id,
                  nickname: participant.nickname,
                });
              }
            }
          }
          
          this.userSocketMap.delete(socket.id);
        }
        
        console.log(`Client disconnected: ${socket.id}`);
      });

      // 하트비트 (연결 상태 확인)
      socket.on('heartbeat', () => {
        socket.emit('heartbeat_ack');
      });
    });
  }

  private generateRoomId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let roomId = '';
    for (let i = 0; i < 6; i++) {
      roomId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return roomId;
  }

  private async loadLyrics(lyricsId: string) {
    try {
      const { data, error } = await supabase
        .from('lyrics')
        .select('*')
        .eq('id', lyricsId)
        .single();

      if (error) throw error;
      
      return {
        id: data.id,
        title: data.title,
        artist: data.artist,
        lines: data.lines,
      };
    } catch (error) {
      console.error('Failed to load lyrics:', error);
      return null;
    }
  }

  getRoomState(roomId: string): RoomState | undefined {
    return this.rooms.get(roomId);
  }

  getRoomCount(): number {
    return this.rooms.size;
  }

  getParticipantCount(roomId: string): number {
    const room = this.rooms.get(roomId);
    return room ? room.participants.size : 0;
  }
}

export const wsServer = new WebSocketServer();