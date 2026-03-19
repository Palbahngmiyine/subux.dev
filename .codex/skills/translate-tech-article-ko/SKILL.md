---
name: translate-tech-article-ko
description: Translate English technical articles into publication-ready Korean Markdown for this repository, matching the tone and structure of the examples in src/translations/. Use when the user wants a Korean blog translation with frontmatter, an original-source link, and natural explanatory prose instead of literal sentence-by-sentence translation.
---

# Translate Tech Article to Korean

## Overview

영어 기술 아티클을 이 저장소의 `src/translations/` 번역본들과 같은 톤으로 한국어 Markdown으로 옮긴다.  
출력은 요약문이 아니라 게시 가능한 완성본이어야 하며, 기본 결과 형식은 frontmatter와 문서 서두의 원문 링크 안내 bullet을 포함한 Markdown이다.

## Use This Skill When

- 사용자가 영어 기술 아티클을 한국어로 번역해달라고 요청했다.
- 결과물을 블로그 게시용 Markdown으로 바로 쓰고 싶어 한다.
- 기존 `src/translations/`와 비슷한 문체와 구성으로 맞추길 원한다.

## Required Inputs

- 원문 URL
- 가능하면 원문 Markdown 또는 본문 전문

원칙:

- URL만 있고 본문 확보 수단이 없으면, 원문 본문 제공을 요청한다.
- 본문이 있으면 그 본문을 기준으로 번역한다.

## Workflow

1. 스타일 기준을 먼저 읽는다.
   - 항상 `references/style-guide.md`부터 본다.
   - 문서 유형이 애매하거나 구조가 특이하면 `src/translations/*.md` 샘플도 다시 연다.
2. 원문 정보를 확정한다.
   - 제목, URL, 발행일, 출처 이름을 확인한다.
   - 발행일이 불명확하면 현재 날짜를 기본값으로 쓴다.
3. 번역한다.
   - 의미와 논리를 보존하고, 문장 모양은 한국어에 맞게 재구성한다.
   - 핵심 기술 용어만 첫 등장에 영어를 병기한다.
   - 코드, 링크, 이미지, 목록 구조는 유지한다.
4. Markdown으로 정리한다.
   - `references/output-template.md` 형식을 따른다.
   - `title`은 기본적으로 영문 원제를 유지한다.
   - 본문보다 앞에 원문 링크 bullet을 반드시 넣는다.
   - 가능하면 `- 원문은 [Source Name의 원 글](URL)을 확인해주세요.` 형식을 그대로 쓴다.
5. 마지막에 `references/checklist.md`로 자체 검수한다.

## Output Contract

- 기본 출력은 게시 가능한 Markdown 전문이다.
- 서두에는 원문과 링크를 명시하는 bullet이 반드시 있어야 한다.
- 파일 저장까지 요청받으면 기본 대상은 `src/translations/<slug>.md`다.
- 별도 요청이 없으면 번역 설명이나 장황한 메타 코멘트는 붙이지 않는다.

## Translation Defaults

- 자연스러운 의역 우선
- 설명형 기술 블로그 문체
- 핵심 용어 선택적 영어 병기
- 원문 구조 존중, 한국어 가독성을 위한 재단락 허용
- 원문에 없는 주장 추가 금지

## Resources

- `references/style-guide.md`: 번역 톤, 용어, 구조 규칙
- `references/output-template.md`: frontmatter와 출력 형식
- `references/checklist.md`: 최종 검수 항목
