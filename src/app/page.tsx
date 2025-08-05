import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center space-y-8 mb-16">
          <h1 className="text-5xl font-bold text-white mb-4">
            🎤 노래방 가사 번역기
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            노래 방송을 위한 실시간 가라오케 스타일 가사 표시 및 번역.
            해외 시청자들과 소통하기에 완벽합니다!
          </p>
          
          <div className="flex gap-4 justify-center mt-8 flex-wrap">
            <Link href="/demo">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                데모 체험
              </Button>
            </Link>
            <Link href="/overlay/help">
              <Button size="lg" variant="outline" className="text-white border-white hover:bg-white hover:text-gray-900">
                OBS 설정 가이드
              </Button>
            </Link>
            <Link href="/control">
              <Button size="lg" className="bg-green-600 hover:bg-green-700">
                컨트롤 패널
              </Button>
            </Link>
          </div>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-white mb-4">✨ 주요 기능</h2>
            <ul className="space-y-3 text-gray-300">
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Spotify, Genius, YouTube에서 자동 가사 가져오기</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>부드러운 애니메이션의 단어별 가라오케 하이라이트</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>20개 이상의 언어로 실시간 번역</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>OBS용 투명 배경 오버레이</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>사용자 정의 스타일 및 애니메이션</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>속도 및 타이밍 조정이 가능한 재생 컨트롤</span>
              </li>
            </ul>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-white mb-4">🚀 빠른 시작</h2>
            <ol className="space-y-3 text-gray-300">
              <li className="flex items-start">
                <span className="text-blue-500 mr-3 font-bold">1.</span>
                <span>노래 이름, 아티스트로 검색하거나 YouTube/Spotify URL 붙여넣기</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-500 mr-3 font-bold">2.</span>
                <span>원하는 번역 언어 선택</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-500 mr-3 font-bold">3.</span>
                <span>스트리밍용으로 투명 배경의 OBS 오버레이 사용</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-500 mr-3 font-bold">4.</span>
                <span>방송에 맞게 색상, 글꼴, 애니메이션 사용자 정의</span>
              </li>
            </ol>
          </div>
        </div>
        
        <div className="mt-16 text-center">
          <div className="bg-gray-800 rounded-lg p-6 max-w-3xl mx-auto">
            <h3 className="text-xl font-semibold text-white mb-4">OBS 브라우저 소스 URL 예시:</h3>
            <code className="block bg-gray-900 px-4 py-3 rounded text-green-400 text-sm break-all">
              {typeof window !== 'undefined' && `${window.location.origin}/overlay?q=아이유+좋은날&lang=en`}
            </code>
            <p className="text-gray-400 mt-2 text-sm">
              OBS에서 투명 배경으로 브라우저 소스로 추가하세요
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}