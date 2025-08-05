## Task 000N: 강의(Course) 도메인 및 목록/상세 페이지 구현

### 목표

데이터베이스에 저장된 강의, 챕터, 영상 정보를 조회하고, 사용자가 이를 탐색할 수 있는 강의 목록 페이지와 상세 페이지를 구현합니다.

### 작업 상세

- [x] **백엔드 (Server Actions)**

  - **서버 액션 구현 (`src/domains/course/actions/`)**
    - `fetch.action.ts` 파일에 다음 함수들을 구현합니다.
    - `getAllCourses()`: `courses` 테이블의 모든 강의 목록을 조회합니다. `createDrizzleSupabaseClient`를 사용하며, RLS 정책에 따라 공개된 데이터만 가져옵니다.
    - `getCourseBySlug(slug: string)`: 특정 `slug`를 가진 강의 정보와, 해당 강의에 속한 `chapters` 및 `videos` 목록을 함께 조회(join)합니다.

- [x] **프론트엔드 (UI)**
  - **강의 페이지 라우트 생성**
    - `/courses/page.tsx` (강의 목록)
    - `/courses/[slug]/page.tsx` (강의 상세)
  - **UI 컴포넌트 구현 (`src/domains/course/components/`)**
    - `course-card.tsx`: 강의 목록 페이지에서 각 강의를 나타내는 카드 컴포넌트. 썸네일, 제목, 간단한 설명을 표시합니다.
    - `course-list.tsx`: `getAllCourses` 액션을 호출하여 받은 데이터를 `course-card.tsx` 컴포넌트의 배열로 렌더링합니다.
    - `course-toc.tsx`: 강의 상세 페이지에서 챕터와 영상 목록(Table of Contents)을 보여주는 컴포넌트. `Accordion` 컴포넌트를 사용하여 챕터별로 영상을 토글하여 볼 수 있게 합니다.
    - `course-hero.tsx`: 강의 상세 페이지 상단에 표시될 영역. 강의 제목, 설명, 썸네일 이미지, '수강 신청' 버튼을 포함합니다.
  - **페이지 컴포넌트 조합**
    - `/courses/page.tsx`: 서버 컴포넌트로, `getAllCourses` 액션을 직접 호출하고 그 결과를 `course-list.tsx` 클라이언트 컴포넌트에 props로 전달하여 페이지를 완성합니다.
    - `/courses/[slug]/page.tsx`: 서버 컴포넌트로, `params.slug`를 사용하여 `getCourseBySlug` 액션을 호출합니다. 조회된 데이터를 `course-hero.tsx`와 `course-toc.tsx`에 전달하여 상세 페이지를 완성합니다.

### 완료 조건

- `/courses` 경로에서 전체 강의 목록을 볼 수 있음.
- 강의 카드를 클릭하면 `/courses/[slug]` 경로의 상세 페이지로 이동함.
- 강의 상세 페이지에서 강의 정보와 전체 목차(챕터, 영상)를 확인할 수 있음.
- 모든 데이터는 서버 액션을 통해 안전하게 조회됨.
