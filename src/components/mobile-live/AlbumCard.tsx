'use client';

interface AlbumCardProps {
  title: string;
  artist: string;
  album?: string;
  coverUrl?: string;
  textColor?: string;
  compact?: boolean;
}

export default function AlbumCard({ 
  title, 
  artist, 
  album, 
  coverUrl, 
  textColor = '#FFFFFF',
  compact = false 
}: AlbumCardProps) {
  if (!title && !artist) return null;

  return (
    <div 
      className={`
        inline-flex items-center gap-3 
        ${compact ? 'p-2' : 'p-3'} 
        rounded-xl transition-all duration-500
      `}
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        border: 'none',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
      }}
    >
      {/* Album Cover with gradient overlay */}
      <div className="relative">
        {coverUrl ? (
          <div className="relative">
            <img 
              src={coverUrl}
              alt="Album Cover"
              className={`
                ${compact ? 'w-10 h-10' : 'w-12 h-12'} 
                rounded-xl shadow-2xl object-cover
              `}
              style={{
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)'
              }}
            />
            {/* Subtle gradient overlay for depth */}
            <div 
              className="absolute inset-0 rounded-xl"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 100%)',
                pointerEvents: 'none'
              }}
            />
          </div>
        ) : (
          <div 
            className={`
              ${compact ? 'w-10 h-10' : 'w-12 h-12'} 
              rounded-xl flex items-center justify-center
              bg-gradient-to-br from-purple-600 via-pink-500 to-red-500
              shadow-2xl
            `}
          >
            <span className={compact ? 'text-xl' : 'text-2xl'}>🎵</span>
          </div>
        )}
        
        {/* Playing indicator */}
        <div className="absolute -bottom-1 -right-1">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
        </div>
      </div>
      
      {/* Song Info with Apple Music typography */}
      <div className="flex-shrink-0">
        <div 
          className={`
            ${compact ? 'text-sm' : 'text-base'} 
            font-semibold tracking-tight whitespace-nowrap
          `}
          style={{ 
            color: '#000000',
            textShadow: 'none',
            letterSpacing: '-0.02em'
          }}
        >
          {title}
        </div>
        <div 
          className={`
            ${compact ? 'text-xs' : 'text-xs'} 
            opacity-70 whitespace-nowrap mt-0.5
          `}
          style={{ 
            color: '#000000',
            textShadow: 'none'
          }}
        >
          {artist}
        </div>
      </div>
      
      {/* Live indicator */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          <div className="w-1 h-3 bg-black/40 rounded-full animate-music-bar-1" />
          <div className="w-1 h-4 bg-black/40 rounded-full animate-music-bar-2" />
          <div className="w-1 h-2 bg-black/40 rounded-full animate-music-bar-3" />
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse-slow {
          0%, 100% { 
            transform: scale(1);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.37),
                       inset 0 1px 0 rgba(255, 255, 255, 0.1);
          }
          50% { 
            transform: scale(1.02);
            box-shadow: 0 12px 40px rgba(138, 43, 226, 0.3),
                       0 0 60px rgba(138, 43, 226, 0.15),
                       inset 0 1px 0 rgba(255, 255, 255, 0.2);
          }
        }
        
        .animate-pulse-slow {
          animation: pulse-slow 4s ease-in-out infinite;
        }
        
        @keyframes music-bar-1 {
          0%, 100% { height: 12px; }
          50% { height: 20px; }
        }
        
        @keyframes music-bar-2 {
          0%, 100% { height: 16px; }
          50% { height: 8px; }
        }
        
        @keyframes music-bar-3 {
          0%, 100% { height: 8px; }
          50% { height: 16px; }
        }
        
        .animate-music-bar-1 {
          animation: music-bar-1 1s ease-in-out infinite;
        }
        
        .animate-music-bar-2 {
          animation: music-bar-2 1s ease-in-out infinite 0.2s;
        }
        
        .animate-music-bar-3 {
          animation: music-bar-3 1s ease-in-out infinite 0.4s;
        }
      `}</style>
    </div>
  );
}