'use client';

import { useState, useEffect } from 'react';
import { Save, Edit3, X, Check, Database, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface SimpleLyricsEditorProps {
  lyrics: string;
  artist: string;
  title: string;
  onLyricsChange: (lyrics: string) => void;
  isDarkMode: boolean;
}

export default function SimpleLyricsEditor({ 
  lyrics, 
  artist, 
  title, 
  onLyricsChange,
  isDarkMode 
}: SimpleLyricsEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedLyrics, setEditedLyrics] = useState(lyrics);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setEditedLyrics(lyrics);
    setHasChanges(false);
  }, [lyrics]);

  const handleSave = () => {
    onLyricsChange(editedLyrics);
    setIsEditing(false);
    setHasChanges(false);
    toast.success('가사가 수정되었습니다');
  };

  const handleCancel = () => {
    setEditedLyrics(lyrics);
    setIsEditing(false);
    setHasChanges(false);
  };

  const handleTextChange = (value: string) => {
    setEditedLyrics(value);
    setHasChanges(value !== lyrics);
  };

  const saveToDatabase = async () => {
    if (!artist || !title) {
      toast.error('아티스트와 제목이 필요합니다');
      return;
    }

    setIsSaving(true);
    
    try {
      const response = await fetch('/api/lyrics/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artist,
          title,
          lyrics: editedLyrics,
          metadata: {
            savedAt: new Date().toISOString(),
            source: 'user_edited'
          }
        })
      });

      const data = await response.json();
      
      if (data.success) {
        if (data.action === 'updated') {
          toast.success('📝 DB의 가사가 업데이트되었습니다!', { 
            icon: '✅',
            duration: 3000 
          });
        } else {
          toast.success('💾 가사가 DB에 저장되었습니다!', { 
            icon: '🎉',
            duration: 3000 
          });
        }
        setHasChanges(false);
      } else {
        toast.error('저장 실패: ' + data.error);
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error('저장 중 오류가 발생했습니다');
    } finally {
      setIsSaving(false);
    }
  };

  const formatLyrics = () => {
    // Remove extra blank lines and format
    const formatted = editedLyrics
      .split('\n')
      .map(line => line.trim())
      .filter((line, index, arr) => {
        // Keep line if it's not empty or if it's a single empty line between content
        if (line) return true;
        if (index === 0 || index === arr.length - 1) return false;
        return arr[index - 1] && arr[index + 1];
      })
      .join('\n');
    
    setEditedLyrics(formatted);
    setHasChanges(formatted !== lyrics);
    toast.success('가사가 정리되었습니다');
  };

  return (
    <div className={`${
      isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-200'
    } rounded-2xl shadow-sm border p-4`}>
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className={`text-lg font-semibold ${
            isDarkMode ? 'text-white' : 'text-slate-800'
          }`}>
            가사 편집기
          </h3>
          {hasChanges && (
            <span className="text-sm text-orange-500 font-medium">
              (수정됨)
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors ${
                  isDarkMode 
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' 
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <Edit3 className="w-4 h-4" />
                편집
              </button>
              
              <button
                onClick={saveToDatabase}
                disabled={isSaving || (!hasChanges && lyrics === editedLyrics)}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors ${
                  isSaving || (!hasChanges && lyrics === editedLyrics)
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    저장 중...
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4" />
                    DB 저장
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={formatLyrics}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors ${
                  isDarkMode 
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' 
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <RefreshCw className="w-4 h-4" />
                정리
              </button>
              
              <button
                onClick={handleCancel}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors ${
                  isDarkMode 
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' 
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <X className="w-4 h-4" />
                취소
              </button>
              
              <button
                onClick={handleSave}
                className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg flex items-center gap-2 transition-colors"
              >
                <Check className="w-4 h-4" />
                적용
              </button>
            </>
          )}
        </div>
      </div>
      
      {/* Song Info */}
      <div className={`mb-4 p-3 rounded-lg ${
        isDarkMode ? 'bg-gray-700' : 'bg-slate-50'
      }`}>
        <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-slate-600'}`}>
          <span className="font-medium">아티스트:</span> {artist || '미지정'}
        </p>
        <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-slate-600'}`}>
          <span className="font-medium">제목:</span> {title || '미지정'}
        </p>
      </div>
      
      {/* Lyrics Editor */}
      <div className="relative">
        {isEditing ? (
          <textarea
            value={editedLyrics}
            onChange={(e) => handleTextChange(e.target.value)}
            className={`w-full h-96 p-4 rounded-lg font-mono text-sm resize-none ${
              isDarkMode 
                ? 'bg-gray-900 text-gray-100 border-gray-700' 
                : 'bg-slate-50 text-slate-800 border-slate-200'
            } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
            placeholder="가사를 입력하세요..."
            spellCheck={false}
          />
        ) : (
          <div className={`w-full h-96 p-4 rounded-lg font-mono text-sm overflow-y-auto ${
            isDarkMode 
              ? 'bg-gray-900 text-gray-100 border-gray-700' 
              : 'bg-slate-50 text-slate-800 border-slate-200'
          } border`}>
            <pre className="whitespace-pre-wrap break-words">
              {editedLyrics || '가사가 없습니다. 편집 버튼을 눌러 추가하세요.'}
            </pre>
          </div>
        )}
        
        {/* Line Count */}
        <div className={`absolute bottom-2 right-2 text-xs ${
          isDarkMode ? 'text-gray-500' : 'text-slate-400'
        }`}>
          {editedLyrics.split('\n').filter(line => line.trim()).length} 줄
        </div>
      </div>
      
      {/* Tips */}
      {isEditing && (
        <div className={`mt-3 p-3 rounded-lg text-sm ${
          isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-blue-50 text-blue-700'
        }`}>
          💡 팁: 각 줄은 Enter로 구분하세요. "정리" 버튼을 누르면 빈 줄이 정리됩니다.
        </div>
      )}
    </div>
  );
}