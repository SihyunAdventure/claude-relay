# Claude Relay

모바일에서 맥북의 Claude Code를 사용할 수 있게 해주는 오픈소스 릴레이.

```
모바일 브라우저 → Convex (클라우드 DB) → 맥북 relay → Claude Agent SDK
```

## Quick Start

### 1. Convex 가입

[convex.dev](https://convex.dev)에서 무료 가입

### 2. 맥북에서 실행

```bash
git clone https://github.com/SihyunAdventure/claude-relay
cd claude-relay
npm install
npm run setup
```

`npm run setup`이 Convex 프로젝트 생성과 relay 시작을 자동으로 처리합니다.

### 3. 모바일에서 접속

https://claude-relay-sh.vercel.app 접속 → 터미널에 표시된 연결 URL 입력 → 끝!

## 구조

| 구성 요소 | 역할 |
|-----------|------|
| **웹 UI** (Vercel) | 채팅 인터페이스. 메시지를 Convex에 저장/읽기 |
| **Convex** (클라우드 DB) | 모바일과 맥북 사이의 메시지 중계 |
| **Relay** (맥북 로컬) | Convex에서 메시지를 가져와 Claude Agent SDK 실행 |

## 스크립트

| 명령어 | 설명 |
|--------|------|
| `npm run setup` | Convex 설정 + relay 시작 (처음 사용 시) |
| `npm run relay` | relay만 시작 (이미 설정된 경우) |
| `npm run dev` | 웹 UI 로컬 개발 서버 |

## 요구 사항

- Node.js 18+
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) 설치 및 인증
- Convex 계정 (무료)

## 기능

- 마크다운 렌더링
- 도구 호출 접이식 패널
- AskUserQuestion 선택 옵션 버튼
- 세션 관리 (다중 프로젝트)
- 최근 프로젝트 경로 저장
- 세션 이어하기 (Agent SDK resume)

## 라이선스

MIT
