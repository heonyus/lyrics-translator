아래는 **OpenAI Realtime API**, **GPT‑4o / GPT‑4o‑Mini**, **Soniox STT**, **Google Gemini Translation**, **Google Translate API**, **Google Text-to-Speech API**의 최신 정보(2025년 기준)를 정리한 마크다운 문서입니다.
특히 **가성비 및 속도 중심 모델 추천**, **각 API 사용 예시 및 가격 정보**를 담고 있으며, PRD에 바로 인용 가능하게 구성했습니다.

---

````markdown
# 📘 통합 API 가이드 (2025년 기준)

## 🔹 요약 전표

| API | 주요 기능 | 추천 모델 | 가격 (1M 단위) | 비고 |
|-----|----------|-----------|------------------|------|
| OpenAI Realtime API | 음성 입력→번역→음성 출력 (통합) | GPT‑4o‑Mini‑Realtime (가성비) | 입력 $10 + 출력 $20 (음성)<br>텍스트 출력 포함 고사양 GPT‑4o: 입력 $100 + 출력 $200 (오디오) | 초저지연, WebSocket 기반 스트리밍 :contentReference[oaicite:2]{index=2} |
| GPT‑4o / GPT‑4o‑Mini | 텍스트 기반 출력 모델 | Mini 모델 | 텍스트 입력 $0.60 / 출력 $2.40 | 텍스트 번역 또는 CC용 대체 가능 :contentReference[oaicite:3]{index=3} |
| Soniox STT | 고정밀 한국어 STT | 기본 STT API | 입력 오디오 토큰 $2,000 / 1M tokens ≒ 약 $0.06/분 | 실시간 스트리밍, 60+ 언어 지원 :contentReference[oaicite:4]{index=4} |
| Gemini Translation (LLM) | 자연스러운 텍스트 번역 | Gemini 2.0 Flash‑Lite (가성비) | 텍스트 입력 $0.019 / 1M tokens | 지능적 번역, Google Translate 대비 저비용 :contentReference[oaicite:5]{index=5} |
| Google Translate API | 일반 텍스트 번역 | 기본 모델 | 첫 500K chars 무료, 이후 $20/M chars | 간편, 안정적, 넓은 언어 지원 :contentReference[oaicite:6]{index=6} |
| Google TTS (WaveNet) | 텍스트 → 자연음성 합성 | WaveNet 음성 | 월 1M chars 무료, 이후 과금 | 감정, 억양, 속도 조절 가능 :contentReference[oaicite:7]{index=7} |

---

## 1. OpenAI Realtime API (GPT‑4o / Mini)

### 🛠 사용 방식 & Instruction Prompt
- WebSocket 연결: `wss://api.openai.com/v1/realtime?model=gpt‑4o‑realtime‑preview‑2025‑06‑03`
- 연결 시:
```json
{
  "type": "response.create",
  "response": {
    "modalities": ["audio"],
    "instructions": "Translate from Korean to English and respond only in English speech."
  }
}
````

* 이후 마이크 데이터를 바로 전송하면 GPT‑4o가 자동으로 음성을 인식 → 번역 → 음성 출력

### 💡 모델 선택

* **GPT‑4o (풀 모델)**: 음성 입력 \$100 + 출력 \$200 per 1M audio‑tokens
* **GPT‑4o‑Mini (가성비)**: 입력 \$10 + 출력 \$20 per 1M audio‑tokens — 실시간 통역 데모용 추천 ([Economize Cloud][1])

---

## 2. 개별 조합: Soniox STT + 번역 + TTS

### ▶ Soniox STT

* WebSocket 스트리밍: `wss://api.soniox.com/v1/stt/streaming`
* 요청 포맷:

```json
{
  "access_key": "<SONIOX_API_KEY>",
  "language": "ko-KR",
  "audio_format": "pcm_s16le",
  "sample_rate": 16000
}
```

* 음성을 텍스트로 변환 → 번역 파이프라인으로 전달 ([Speech-to-Text AI | Soniox][2])

### ▶ Gemini 2.0 Flash-Lite 번역

* 번역 Prompt 예시: `Translate "안녕하세요" into English.`
* 가격: \$0.019 per 1M tokens 입력 기준 (번역 저비용) ([Medium][3], [Reuters][4])

### ▶ Google Translate API

* HTTP POST 사용: `https://translation.googleapis.com/language/translate/v2`
* 요청 예시:

```json
{
  "q": "안녕하세요",
  "source": "ko",
  "target": "en",
  "format": "text"
}
```

* 첫 500K characters 무료, 이후 \$20 per 1M chars ([Medium][3], [googlecloudcommunity.com][5])

### ▶ Google Text‑to‑Speech API

* HTTP POST: `https://texttospeech.googleapis.com/v1/text:synthesize`
* 요청 예시:

```json
{
  "input": { "text": "Hello" },
  "voice": { "languageCode": "en-US", "name": "en-US-Wavenet-D" },
  "audioConfig": { "audioEncoding": "MP3" }
}
```

* 무료 1M characters(WaveNet) / 4M(Standard) 매월 제공, 이후 과금 ([Google Cloud][6])

---

## 2. pipeline 조합 구성 추천

```
Mic → STT (Soniox) → 번역 (Gemini Flash‑Lite 또는 Google Translate) → TTS (Google WaveNet) → 재생
```

* Soniox와 Gemini Flash-Lite 조합은 **가성비와 응답 속도 모두 우수**
* GPT‑4o Mini Realtime은 전체 통합 흐름에서 가장 단순 → 지연 최소화

---

## ✅ 결론 & 추천

* **가장 빠르고 간단하게 시작**하려면 → **GPT‑4o‑Mini Realtime API**
* **예산 최적화 및 개별 서비스 제어**가 필요하면 → **Soniox STT + Gemini Flash‑Lite 번역 + Google TTS WaveNet** 조합
* **문서 활용**: 이 마크다운은 PRD 및 개발 문서에 바로 포함 가능하며, 환경 변수 설정 및 모듈화 구조와 매칭 가능합니다

필요하시면 이 마크다운을 `.md` 파일로 변환해 드리거나, PRD에 삽입 가능한 형식을 함께 제공해드릴 수 있습니다. 원하시면 알려주세요!

[1]: https://www.economize.cloud/resources/open-ai/pricing/gpt-4o/?utm_source=chatgpt.com "Resources - Economize Cloud"
[2]: https://soniox.com/products/speech-to-text/?utm_source=chatgpt.com "Speech-to-Text API with speaker recognition - Soniox"
[3]: https://medium.com/%40stephane.giron/turn-gemini-pro-to-a-translate-api-can-gemini-compet-with-google-translate-api-22a7b2974dd9?utm_source=chatgpt.com "Turn Gemini Pro to a Translate API, can Gemini compet with Google ..."
[4]: https://www.reuters.com/technology/artificial-intelligence/google-introduces-new-class-cheap-ai-models-cost-concerns-intensify-2025-02-05/?utm_source=chatgpt.com "Google introduces new class of cheap AI models as cost concerns intensify"
[5]: https://www.googlecloudcommunity.com/gc/AI-ML/translation-api-pricing/m-p/690079?utm_source=chatgpt.com "translation api pricing - Google Cloud Community"
[6]: https://cloud.google.com/text-to-speech?utm_source=chatgpt.com "Text-to-Speech AI: Lifelike Speech Synthesis - Google Cloud"
