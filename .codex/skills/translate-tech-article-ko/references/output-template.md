# Output Template

기본 산출물은 `src/translations/`에 바로 넣을 수 있는 완성형 Markdown이다.

## Frontmatter

```md
---
title: Original English Title
date: YYYY-MM-DD
---
```

규칙:

- `title`은 기본적으로 원문 영문 제목을 유지한다.
- `date`는 원문 발행일이 명확하면 그 날짜를 쓴다.
- 원문 발행일을 확인할 수 없으면 작업 당일 날짜를 쓴다.

## Opening Source Line

이 줄은 선택 사항이 아니다. frontmatter 바로 아래, 본문보다 앞에 반드시 넣는다.

기본 형식:

```md
- 원문은 [Source Name의 원 글](https://example.com/article)을 확인해주세요.
```

예시:

```md
- 원문은 [Anthropic의 원 글](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)을 확인해주세요.
```

출처 이름을 자연스럽게 넣기 어렵거나 확인할 수 없을 때만 아래 축약형을 쓴다.

```md
- 원문은 [원 글](https://example.com/article)을 확인해주세요.
```

금지:

- 원문 링크 안내 줄 생략
- 본문 중간이나 말미에 출처 배치
- 링크 없이 출처 이름만 적기

## Body Rules

- 본문은 게시 가능한 완성본이어야 한다.
- 서론, 소제목, 목록, 이미지, 링크 구조를 보존한다.
- 코드 블록이 있으면 fence와 언어 표기를 유지한다.
- 제목을 제외한 본문은 한국어로 번역한다. 단, 용어/제품명/코드/식별자는 원문 표기를 유지할 수 있다.

## File Placement

파일로 저장하라는 요청까지 있으면 기본 경로는 아래를 따른다.

```text
src/translations/<english-title-or-source-slug>.md
```

slug 규칙:

- 소문자 kebab-case
- 불필요한 부호 제거
- 원문 URL 경로가 더 안정적이면 그 slug를 우선
