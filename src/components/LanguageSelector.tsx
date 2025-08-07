import React, { useState } from 'react';
import { Globe, X, Check } from 'lucide-react';

interface Language {
  code: string;
  name: string;
  nativeName: string;
  category: string;
}

const LANGUAGES: Language[] = [
  // Asian Languages
  { code: 'ko', name: 'Korean', nativeName: '한국어', category: 'Asian' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', category: 'Asian' },
  { code: 'zh', name: 'Chinese (Simplified)', nativeName: '简体中文', category: 'Asian' },
  { code: 'zh-TW', name: 'Chinese (Traditional)', nativeName: '繁體中文', category: 'Asian' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย', category: 'Asian' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', category: 'Asian' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', category: 'Asian' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', category: 'Asian' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', category: 'Asian' },
  
  // European Languages
  { code: 'en', name: 'English', nativeName: 'English', category: 'European' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', category: 'European' },
  { code: 'fr', name: 'French', nativeName: 'Français', category: 'European' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', category: 'European' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', category: 'European' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', category: 'European' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', category: 'European' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', category: 'European' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', category: 'European' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska', category: 'European' },
  { code: 'no', name: 'Norwegian', nativeName: 'Norsk', category: 'European' },
  
  // Middle Eastern & Others
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', category: 'Middle East' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', category: 'Middle East' },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית', category: 'Middle East' },
];

interface LanguageSelectorProps {
  selectedLanguages: string[];
  onLanguageChange: (languages: string[]) => void;
  isDarkMode?: boolean;
}

export default function LanguageSelector({ 
  selectedLanguages, 
  onLanguageChange,
  isDarkMode = false 
}: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLanguages = LANGUAGES.filter(lang =>
    lang.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lang.nativeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lang.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleLanguage = (code: string) => {
    if (selectedLanguages.includes(code)) {
      onLanguageChange(selectedLanguages.filter(l => l !== code));
    } else {
      onLanguageChange([...selectedLanguages, code]);
    }
  };

  const selectAll = () => {
    onLanguageChange(LANGUAGES.map(l => l.code));
  };

  const deselectAll = () => {
    onLanguageChange([]);
  };

  const groupedLanguages = filteredLanguages.reduce((acc, lang) => {
    if (!acc[lang.category]) {
      acc[lang.category] = [];
    }
    acc[lang.category].push(lang);
    return acc;
  }, {} as Record<string, Language[]>);

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
          isDarkMode 
            ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
            : 'bg-blue-500 hover:bg-blue-600 text-white'
        }`}
      >
        <Globe className="w-4 h-4" />
        <span>번역 언어 ({selectedLanguages.length})</span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className={`w-full max-w-3xl max-h-[80vh] rounded-2xl shadow-2xl flex flex-col ${
            isDarkMode ? 'bg-gray-800' : 'bg-white'
          }`}>
            {/* Header */}
            <div className={`flex items-center justify-between p-6 border-b ${
              isDarkMode ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <h2 className={`text-xl font-bold ${
                isDarkMode ? 'text-white' : 'text-gray-800'
              }`}>
                번역 언어 선택
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className={`p-2 rounded-lg transition-colors ${
                  isDarkMode 
                    ? 'hover:bg-gray-700 text-gray-400'
                    : 'hover:bg-gray-100 text-gray-600'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search & Actions */}
            <div className={`p-4 border-b ${
              isDarkMode ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="언어 검색..."
                  className={`flex-1 px-4 py-2 rounded-lg ${
                    isDarkMode 
                      ? 'bg-gray-700 text-white placeholder-gray-400'
                      : 'bg-gray-100 text-gray-800 placeholder-gray-500'
                  }`}
                />
                <button
                  onClick={selectAll}
                  className={`px-4 py-2 rounded-lg text-sm ${
                    isDarkMode 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                >
                  전체 선택
                </button>
                <button
                  onClick={deselectAll}
                  className={`px-4 py-2 rounded-lg text-sm ${
                    isDarkMode 
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  }`}
                >
                  전체 해제
                </button>
              </div>
            </div>

            {/* Language List */}
            <div className="flex-1 overflow-y-auto p-4">
              {Object.entries(groupedLanguages).map(([category, languages]) => (
                <div key={category} className="mb-6">
                  <h3 className={`text-sm font-semibold mb-3 ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    {category}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {languages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => toggleLanguage(lang.code)}
                        className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                          selectedLanguages.includes(lang.code)
                            ? isDarkMode 
                              ? 'bg-blue-600 text-white'
                              : 'bg-blue-100 text-blue-700 border-2 border-blue-500'
                            : isDarkMode
                              ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                              : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-2 border-gray-200'
                        }`}
                      >
                        <div className="flex flex-col items-start">
                          <span className="font-medium">{lang.name}</span>
                          <span className={`text-xs ${
                            selectedLanguages.includes(lang.code)
                              ? 'opacity-90'
                              : 'opacity-60'
                          }`}>
                            {lang.nativeName}
                          </span>
                        </div>
                        {selectedLanguages.includes(lang.code) && (
                          <Check className="w-4 h-4" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className={`p-4 border-t ${
              isDarkMode ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <div className="flex justify-between items-center">
                <span className={`text-sm ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {selectedLanguages.length}개 언어 선택됨
                </span>
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium"
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}