---
name: ko-translation-qa
description: Review a Korean translation against its English source and report meaning drift, omissions, overtranslation, mistranslations, awkward wording, typos, and spelling issues. Use when Codex needs to QA translated Markdown, technical blog drafts, docs, or repository translation outputs before publishing or before revising the Korean text.
---

# Korean Translation QA

## Overview

영문 원문과 한국어 번역문을 대조해 번역 품질을 검수한다.
새 번역을 다시 쓰는 대신, 의미 보존과 한국어 완성도를 기준으로 문제를 찾고 최소 수정으로 바로잡는다.

## Required Inputs

- 영어 원문 전문 또는 충분한 발췌
- 한국어 번역문 전문 또는 충분한 발췌

원칙:

- 두 텍스트를 모두 확보하지 못하면 먼저 부족한 쪽을 요청한다.
- 일부 발췌만 주어진 경우, 전체 품질 보증이 아니라 제공 구간 검수라는 점을 분명히 적는다.
- 원문이 없으면 한국어 교정만 수행하고, 의미 보존 검수는 불가능하다고 명시한다.

## Workflow

1. 검수 범위를 확정한다.
   - 원문과 번역문이 같은 범위를 다루는지 먼저 확인한다.
   - Markdown이라면 제목, 링크, 목록, 코드 블록, 강조, 인용 구조가 대응되는지 빠르게 본다.
2. 프로젝트 기준을 확인한다.
   - 이 저장소 번역 결과물을 검수한다면 `../translate-tech-article-ko/references/style-guide.md`와 `../translate-tech-article-ko/references/checklist.md`를 함께 본다.
3. 의미 보존을 먼저 검수한다.
   - 문단 또는 문장 단위로 대조하며 사실관계, 논리관계, 조건, 뉘앙스가 바뀌지 않았는지 확인한다.
   - 특히 부정문, 비교급, 수량, 시제, 추론 강도, 전제 조건을 우선 본다.
4. 과의역과 누락을 찾는다.
   - 원문에 없는 해설, 단정, 예시, 감정 표현이 추가되지 않았는지 본다.
   - 원문 핵심 정보가 빠졌거나 약해졌는지도 함께 본다.
5. 한국어 문장 품질을 검수한다.
   - 맞춤법, 띄어쓰기, 오타, 중복 표현, 번역투, 호응 어색함, 문체 불일치를 찾는다.
   - 기술 용어는 번역문 내부에서 일관적인지 확인한다.
6. 수정 제안을 정리한다.
   - 문제 유형, 근거, 권장 수정안을 함께 제시한다.
   - 전체를 다시 번역하지 말고 문제 있는 구간만 최소 수정으로 제안한다.
7. 마지막에 `references/checklist.md`로 빠짐없이 점검한다.

## Severity

- `critical`: 의미가 반대로 바뀌거나 핵심 사실이 왜곡됨
- `major`: 원문 의미가 눈에 띄게 약화, 과장, 누락, 과의역됨
- `minor`: 의미는 대체로 맞지만 한국어 표현, 맞춤법, 용어 일관성, 어조가 좋지 않음
- `nit`: 취향 차이에 가까운 미세한 다듬기

## Review Heuristics

- 의미 검수는 항상 문장 자연스러움보다 먼저 한다.
- 원문을 더 자세히 풀어 쓴 경우라도, 새 정보나 새 주장 추가가 있으면 과의역 후보로 본다.
- 한국어를 자연스럽게 만들기 위한 재배열은 허용하지만, 논리 순서가 바뀌며 인과가 흐려지면 지적한다.
- 기술 용어는 무조건 번역하거나 무조건 영어로 두지 말고, 문맥상 의미 전달이 가장 정확한 쪽을 택한다.
- 제목, 캡션, 링크 문구, 표 머리글처럼 짧은 문자열도 본문만큼 엄밀히 검수한다.
- 코드, 명령어, 식별자, 파일 경로는 번역 대상이 아니므로 훼손 여부를 별도로 본다.

## Output Contract

응답은 문제 목록 중심으로 구성한다. 각 항목에는 아래를 포함한다.

- 위치 또는 원문/번역문 발췌
- 심각도
- 무엇이 왜 문제인지
- 권장 수정안

가능하면 아래 형식을 따른다.

```markdown
## Findings

1. [major] ...
   - Source: ...
   - Translation: ...
   - Why: ...
   - Suggested fix: ...
```

문제가 없으면 의미 보존, 과의역 여부, 국문 교정 항목을 각각 짧게 확인하고 "중대 이슈 없음"이라고 명시한다.

## Resources

- `references/checklist.md`: 최종 검수 체크리스트
