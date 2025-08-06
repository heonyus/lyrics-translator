"use client";

import React, { useState, useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { 
  NeonButton, 
  GlassmorphicCard,
  NeonLoader,
  useNeonToast 
} from '@/components/design-system';
import { 
  Wifi, 
  WifiOff, 
  Users, 
  Play, 
  Pause, 
  SkipForward,
  SkipBack,
  Copy,
  Share2,
  MessageSquare,
  Settings,
  Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface WebSocketControlProps {
  currentLyricsId?: string;
  onLyricsChange?: (lyricsId: string) => void;
}

export const WebSocketControl: React.FC<WebSocketControlProps> = ({
  currentLyricsId,
  onLyricsChange,
}) => {
  const { state, connect, disconnect, createRoom, joinRoom, syncPlayback, updateSettings, sendMessage } = useWebSocket();
  const { success, error, info } = useNeonToast();
  
  const [nickname, setNickname] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [chatMessage, setChatMessage] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // 자동 연결
  useEffect(() => {
    const savedNickname = localStorage.getItem('karaoke_nickname');
    if (savedNickname) {
      setNickname(savedNickname);
    }
  }, []);

  // 연결/해제 토글
  const handleConnectionToggle = () => {
    if (state.isConnected) {
      disconnect();
    } else {
      connect();
    }
  };

  // 방 생성
  const handleCreateRoom = () => {
    if (!nickname.trim()) {
      error('닉네임 필요', '닉네임을 입력해주세요.');
      return;
    }
    
    localStorage.setItem('karaoke_nickname', nickname);
    const hostId = `user_${Date.now()}`;
    createRoom(hostId, nickname, currentLyricsId);
  };

  // 방 참가
  const handleJoinRoom = () => {
    if (!nickname.trim()) {
      error('닉네임 필요', '닉네임을 입력해주세요.');
      return;
    }
    
    if (!roomCodeInput.trim()) {
      error('방 코드 필요', '방 코드를 입력해주세요.');
      return;
    }
    
    localStorage.setItem('karaoke_nickname', nickname);
    joinRoom(roomCodeInput.toUpperCase(), nickname);
  };

  // 방 코드 복사
  const handleCopyRoomCode = () => {
    if (state.roomId) {
      navigator.clipboard.writeText(state.roomId);
      success('복사됨', `방 코드 ${state.roomId}가 클립보드에 복사되었습니다.`);
    }
  };

  // 공유 링크 생성
  const handleShare = () => {
    if (state.roomId) {
      const shareUrl = `${window.location.origin}/join?room=${state.roomId}`;
      navigator.clipboard.writeText(shareUrl);
      success('링크 복사됨', '공유 링크가 클립보드에 복사되었습니다.');
    }
  };

  // 재생 제어
  const handlePlayPause = () => {
    if (state.isHost) {
      syncPlayback({
        ...state.playbackState,
        isPlaying: !state.playbackState.isPlaying,
      });
    }
  };

  const handleNextLine = () => {
    if (state.isHost && state.currentLyrics) {
      const nextIndex = Math.min(
        state.playbackState.currentLineIndex + 1,
        state.currentLyrics.lines.length - 1
      );
      syncPlayback({
        ...state.playbackState,
        currentLineIndex: nextIndex,
        currentWordIndex: 0,
      });
    }
  };

  const handlePrevLine = () => {
    if (state.isHost) {
      const prevIndex = Math.max(state.playbackState.currentLineIndex - 1, 0);
      syncPlayback({
        ...state.playbackState,
        currentLineIndex: prevIndex,
        currentWordIndex: 0,
      });
    }
  };

  // 채팅 전송
  const handleSendMessage = () => {
    if (chatMessage.trim()) {
      sendMessage(chatMessage);
      setChatMessage('');
    }
  };

  // 언어 설정 변경
  const handleLanguageChange = (language: string) => {
    if (state.isHost) {
      updateSettings({ targetLanguage: language });
    }
  };

  // 테마 변경
  const handleThemeChange = (theme: 'dark' | 'light' | 'neon') => {
    if (state.isHost) {
      updateSettings({ theme });
    }
  };

  return (
    <div className="space-y-6">
      {/* 연결 상태 */}
      <GlassmorphicCard variant="dark" blur="md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-neon-blue flex items-center gap-2">
            {state.isConnected ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
            실시간 동기화
          </h3>
          <NeonButton
            onClick={handleConnectionToggle}
            color={state.isConnected ? "pink" : "green"}
            variant="outline"
            size="sm"
          >
            {state.isConnected ? '연결 해제' : '연결'}
          </NeonButton>
        </div>

        {!state.isConnected ? (
          <div className="text-center py-8">
            <p className="text-gray-400 mb-4">서버에 연결하여 실시간 동기화를 시작하세요</p>
            <NeonButton onClick={connect} color="blue" size="lg" pulse>
              서버 연결
            </NeonButton>
          </div>
        ) : !state.roomId ? (
          <div className="space-y-4">
            {/* 닉네임 입력 */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                닉네임
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="닉네임을 입력하세요"
                className="w-full px-4 py-2 bg-black/50 border border-neon-blue/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-neon-blue"
              />
            </div>

            {/* 방 생성/참가 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h4 className="text-lg font-semibold text-neon-pink">새 방 만들기</h4>
                <p className="text-sm text-gray-400">호스트가 되어 가사를 제어합니다</p>
                <NeonButton 
                  onClick={handleCreateRoom} 
                  color="pink" 
                  variant="solid"
                  className="w-full"
                  disabled={!nickname.trim()}
                >
                  방 만들기
                </NeonButton>
              </div>

              <div className="space-y-3">
                <h4 className="text-lg font-semibold text-neon-green">방 참가하기</h4>
                <input
                  type="text"
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                  placeholder="방 코드 입력 (예: ABC123)"
                  maxLength={6}
                  className="w-full px-4 py-2 bg-black/50 border border-neon-green/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-neon-green"
                />
                <NeonButton 
                  onClick={handleJoinRoom} 
                  color="green" 
                  variant="solid"
                  className="w-full"
                  disabled={!nickname.trim() || !roomCodeInput.trim()}
                >
                  참가하기
                </NeonButton>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 방 정보 */}
            <div className="flex items-center justify-between p-4 bg-black/30 rounded-lg">
              <div>
                <p className="text-sm text-gray-400">방 코드</p>
                <p className="text-2xl font-bold text-neon-yellow">{state.roomId}</p>
              </div>
              <div className="flex gap-2">
                <NeonButton onClick={handleCopyRoomCode} color="yellow" variant="ghost" size="sm">
                  <Copy className="w-4 h-4" />
                </NeonButton>
                <NeonButton onClick={handleShare} color="yellow" variant="ghost" size="sm">
                  <Share2 className="w-4 h-4" />
                </NeonButton>
              </div>
            </div>

            {/* 참가자 목록 */}
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <Users className="w-4 h-4" />
                참가자 ({state.participants.size}명)
              </h4>
              <div className="flex flex-wrap gap-2">
                {Array.from(state.participants.values()).map((participant) => (
                  <span
                    key={participant.id}
                    className={`px-3 py-1 rounded-full text-xs ${
                      participant.role === 'host'
                        ? 'bg-neon-pink/20 text-neon-pink border border-neon-pink/30'
                        : 'bg-neon-blue/20 text-neon-blue border border-neon-blue/30'
                    }`}
                  >
                    {participant.nickname}
                    {participant.role === 'host' && ' 👑'}
                  </span>
                ))}
              </div>
            </div>

            {/* 재생 컨트롤 (호스트만) */}
            {state.isHost && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-300">재생 제어</h4>
                <div className="flex justify-center gap-4">
                  <NeonButton onClick={handlePrevLine} color="blue" variant="outline" size="sm">
                    <SkipBack className="w-4 h-4" />
                  </NeonButton>
                  <NeonButton onClick={handlePlayPause} color="blue" variant="solid" size="lg">
                    {state.playbackState.isPlaying ? (
                      <Pause className="w-6 h-6" />
                    ) : (
                      <Play className="w-6 h-6" />
                    )}
                  </NeonButton>
                  <NeonButton onClick={handleNextLine} color="blue" variant="outline" size="sm">
                    <SkipForward className="w-4 h-4" />
                  </NeonButton>
                </div>

                {/* 재생 상태 */}
                <div className="text-center text-sm text-gray-400">
                  라인: {state.playbackState.currentLineIndex + 1} / {state.currentLyrics?.lines.length || 0}
                </div>
              </div>
            )}

            {/* 추가 기능 버튼 */}
            <div className="flex gap-2">
              <NeonButton
                onClick={() => setShowChat(!showChat)}
                color="purple"
                variant="outline"
                size="sm"
                className="flex-1"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                채팅 ({state.messages.length})
              </NeonButton>
              
              {state.isHost && (
                <NeonButton
                  onClick={() => setShowSettings(!showSettings)}
                  color="purple"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  설정
                </NeonButton>
              )}
            </div>
          </div>
        )}
      </GlassmorphicCard>

      {/* 채팅 패널 */}
      <AnimatePresence>
        {showChat && state.roomId && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <GlassmorphicCard variant="dark" blur="md">
              <h4 className="text-lg font-semibold text-neon-purple mb-3">채팅</h4>
              
              {/* 메시지 목록 */}
              <div className="h-48 overflow-y-auto mb-3 space-y-2 p-3 bg-black/30 rounded-lg">
                {state.messages.length === 0 ? (
                  <p className="text-gray-500 text-center">아직 메시지가 없습니다</p>
                ) : (
                  state.messages.map((msg, index) => (
                    <div key={index} className="text-sm">
                      <span className="text-neon-purple font-semibold">{msg.from}:</span>
                      <span className="text-gray-300 ml-2">{msg.message}</span>
                    </div>
                  ))
                )}
              </div>
              
              {/* 메시지 입력 */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="메시지 입력..."
                  className="flex-1 px-3 py-2 bg-black/50 border border-neon-purple/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-neon-purple"
                />
                <NeonButton onClick={handleSendMessage} color="purple" size="sm">
                  전송
                </NeonButton>
              </div>
            </GlassmorphicCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 설정 패널 (호스트만) */}
      <AnimatePresence>
        {showSettings && state.isHost && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <GlassmorphicCard variant="dark" blur="md">
              <h4 className="text-lg font-semibold text-neon-orange mb-4">방 설정</h4>
              
              <div className="space-y-4">
                {/* 번역 언어 */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <Globe className="w-4 h-4 inline mr-2" />
                    번역 언어
                  </label>
                  <select
                    value={state.settings.targetLanguage}
                    onChange={(e) => handleLanguageChange(e.target.value)}
                    className="w-full px-3 py-2 bg-black/50 border border-neon-orange/30 rounded-lg text-white focus:outline-none focus:border-neon-orange"
                  >
                    <option value="en">English</option>
                    <option value="ja">日本語</option>
                    <option value="zh">中文</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                    <option value="de">Deutsch</option>
                    <option value="ru">Русский</option>
                    <option value="ar">العربية</option>
                  </select>
                </div>

                {/* 테마 */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">테마</label>
                  <div className="flex gap-2">
                    {(['dark', 'light', 'neon'] as const).map((theme) => (
                      <NeonButton
                        key={theme}
                        onClick={() => handleThemeChange(theme)}
                        color="orange"
                        variant={state.settings.theme === theme ? 'solid' : 'outline'}
                        size="sm"
                        className="flex-1"
                      >
                        {theme === 'dark' ? '다크' : theme === 'light' ? '라이트' : '네온'}
                      </NeonButton>
                    ))}
                  </div>
                </div>

                {/* 표시 옵션 */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={state.settings.showOriginal}
                      onChange={(e) => updateSettings({ showOriginal: e.target.checked })}
                      className="rounded border-neon-orange/30 bg-black/50 text-neon-orange focus:ring-neon-orange"
                    />
                    <span className="text-sm text-gray-300">원본 가사 표시</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={state.settings.showTranslation}
                      onChange={(e) => updateSettings({ showTranslation: e.target.checked })}
                      className="rounded border-neon-orange/30 bg-black/50 text-neon-orange focus:ring-neon-orange"
                    />
                    <span className="text-sm text-gray-300">번역 가사 표시</span>
                  </label>
                </div>
              </div>
            </GlassmorphicCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};