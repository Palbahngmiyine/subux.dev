---
title: Effective harnesses for long-running agents
date: 2026-03-26
---

- 원문은 [Anthropic의 원 글](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)을 확인해주세요.

여러 context window를 오가며 일하는 agent는 여전히 어려움을 겪습니다. Anthropic은 사람 엔지니어가 실제로 일하는 방식을 참고해, long-running agent를 위한 더 효과적인 harness를 설계했습니다.

AI agent가 더 유능해질수록 개발자는 수시간, 길게는 며칠에 걸친 복잡한 작업을 맡기기 시작했습니다. 하지만 여러 context window에 걸쳐 agent가 일관된 진척을 내도록 만드는 일은 여전히 미해결 과제입니다.

long-running agent의 핵심 난제는 작업이 이산적인 세션 단위로 나뉜다는 점입니다. 새로운 세션은 이전 일을 기억하지 못한 채 시작됩니다. 교대 근무하는 엔지니어들이 투입된 소프트웨어 프로젝트를 떠올려보면 됩니다. 새로 투입된 엔지니어가 직전 교대에서 무슨 일이 있었는지 전혀 모른 채 일을 이어받는 셈입니다. context window는 제한되어 있고, 대부분의 복잡한 프로젝트는 하나의 window 안에서 끝나지 않기 때문에, agent에게는 코딩 세션 사이의 간극을 메울 장치가 필요합니다.

Anthropic은 [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview)가 많은 context window를 가로질러도 효과적으로 동작하도록 두 부분으로 구성된 해법을 만들었습니다. 첫 실행에서 환경을 준비하는 **initializer agent**와, 매 세션마다 점진적으로 진척을 만들면서 다음 세션을 위해 명확한 산출물을 남기는 **coding agent**입니다. 코드 예시는 함께 제공되는 [quickstart](https://github.com/anthropics/claude-quickstarts/tree/main/autonomous-coding)에서 확인할 수 있습니다.

## The long-running agent problem

Claude Agent SDK는 강력한 범용 agent harness로, 코딩뿐 아니라 모델이 도구를 사용해 context를 수집하고 계획을 세우고 실행해야 하는 다른 작업에도 능숙합니다. 이 SDK는 compaction 같은 context 관리 기능도 제공해, agent가 context window를 소진하지 않고 작업을 이어가게 해줍니다. 이론적으로만 보면 이런 구성이라면 agent가 임의로 긴 시간 동안 계속 유용한 작업을 할 수도 있어 보입니다.

하지만 compaction만으로는 충분하지 않습니다. 별도 보정 없이, Opus 4.5 같은 frontier coding model을 Claude Agent SDK 위에서 여러 context window에 걸쳐 loop로 돌려도, "build a clone of [claude.ai](https://claude.ai)." 같은 고수준 프롬프트만으로는 production 수준의 웹앱을 만들지 못합니다.

Anthropic이 관찰한 Claude의 실패는 두 가지 패턴으로 나타났습니다. 첫째, agent가 한 번에 너무 많은 일을 하려는 경향이 있었습니다. 사실상 앱 전체를 one-shot으로 만들려는 식입니다. 이 경우 모델은 구현 도중 context를 소진했고, 다음 세션은 기능이 반쯤 구현된 데다 문서화도 되지 않은 상태에서 시작하곤 했습니다. 그러면 다음 agent는 무슨 일이 있었는지 추측해야 했고, 기본 앱을 다시 작동시키는 데 상당한 시간을 써야 했습니다. compaction이 있더라도 이런 문제는 발생했습니다. compaction이 다음 agent에게 항상 충분히 명확한 지시를 넘겨주지는 못하기 때문입니다.

둘째 실패 모드는 프로젝트 후반부에서 자주 나타났습니다. 몇몇 기능이 이미 구현된 뒤에 들어온 agent 인스턴스가 주변 상태를 살펴보고, 어느 정도 진척이 있다는 이유만으로 작업이 끝났다고 선언해버리는 경우입니다.

이 문제는 두 부분으로 나눠 생각할 수 있습니다. 먼저, 주어진 프롬프트가 요구하는 **모든** 기능의 기반이 되는 초기 환경을 설정해야 합니다. 그래야 agent가 한 단계씩, 기능 단위로 일할 수 있습니다. 다음으로, 각 agent가 목표를 향해 점진적으로 전진하면서도 세션이 끝날 때 환경을 깨끗한 상태로 남기게 해야 합니다. 여기서 깨끗한 상태란 main 브랜치에 바로 머지해도 될 수준의 코드를 뜻합니다. 큰 버그가 없고, 코드가 정돈돼 있고, 문서화가 돼 있으며, 개발자가 엉뚱한 잔해를 먼저 치우지 않아도 바로 다음 기능 작업을 시작할 수 있는 상태입니다.

Anthropic은 내부 실험에서 이 문제를 아래 두 축으로 해결했습니다.

1. Initializer agent: 첫 번째 agent 세션은 특화된 프롬프트를 사용해 초기 환경을 구성합니다. 여기에는 개발 서버를 띄우는 `init.sh` 스크립트, agent가 무엇을 했는지 기록하는 `claude-progress.txt`, 어떤 파일이 추가됐는지 보여주는 초기 git commit이 포함됩니다.
2. Coding agent: 이후의 모든 세션은 점진적인 진척을 만들고, 구조화된 업데이트를 남기도록 요청받습니다.[^1]

여기서 핵심 통찰은, 새 context window로 시작하는 agent가 작업 상태를 아주 빠르게 파악할 수 있게 만드는 방법을 찾는 일이었습니다. Anthropic은 이를 `claude-progress.txt`와 git history의 조합으로 해결했습니다. 이런 방식은 결국 효과적인 소프트웨어 엔지니어가 매일 실천하는 습관에서 영감을 얻은 것입니다.

## Environment management

업데이트된 [Claude 4 prompting guide](https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices#multi-context-window-workflows)에서 Anthropic은 multi-context window workflow를 위한 모범 사례를 공유했습니다. 그중에는 "첫 번째 context window에만 사용하는 별도의 프롬프트"를 두는 harness 구조도 포함됩니다. 이 별도 프롬프트는 initializer agent가 이후 coding agent가 효과적으로 일하는 데 필요한 맥락을 모두 갖춘 환경을 준비하도록 요청합니다. 여기서는 그런 환경의 핵심 구성 요소를 좀 더 자세히 설명합니다.

### Feature list

agent가 앱 전체를 one-shot으로 만들려 하거나 프로젝트가 너무 일찍 끝났다고 판단하는 문제를 줄이기 위해, Anthropic은 initializer agent에게 사용자의 초기 프롬프트를 더 구체화한 포괄적인 feature requirements 파일을 작성하게 했습니다. `claude.ai` 클론 예제에서는 이것이 200개가 넘는 기능 목록으로 이어졌습니다. 예를 들면 "사용자가 새 채팅을 열고, 질문을 입력하고, 엔터를 누르고, AI 응답을 본다" 같은 기능입니다. 이 기능들은 모두 처음에는 `"passes": false`로 표시됐고, 덕분에 이후 coding agent는 완전한 기능이 어떤 모습이어야 하는지 분명한 윤곽을 갖게 됐습니다.

```json
{
  "category": "functional",
  "description": "New chat button creates a fresh conversation",
  "steps": [
    "Navigate to main interface",
    "Click the 'New Chat' button",
    "Verify a new conversation is created",
    "Check that chat area shows welcome state",
    "Verify conversation appears in sidebar"
  ],
  "passes": false
}
```

Anthropic은 coding agent가 이 파일을 수정할 때 `passes` 필드의 상태만 바꾸게 했고, "테스트를 제거하거나 수정하는 것은 누락되거나 버그 있는 기능으로 이어질 수 있으므로 허용되지 않는다" 같은 강한 표현도 사용했습니다. 몇 차례 실험 끝에 Anthropic은 이 용도에 JSON을 택했습니다. 모델이 Markdown 파일보다 JSON 파일을 부적절하게 바꾸거나 통째로 덮어쓸 가능성이 더 낮았기 때문입니다.

### Incremental progress

이런 초기 환경 스캐폴딩이 준비되자, 다음 단계의 coding agent는 한 번에 하나의 기능만 작업하도록 요청받았습니다. 이런 점진적 접근은 agent가 한꺼번에 너무 많은 일을 하려는 성향을 제어하는 데 결정적이었습니다.

점진적으로 작업하더라도, 코드 변경 뒤에 환경을 깨끗한 상태로 남기는 일은 여전히 중요합니다. Anthropic의 실험에서는, 이를 끌어내는 가장 좋은 방법이 모델에게 설명적인 commit message와 함께 git에 진행 상황을 commit하고, progress 파일에 요약을 남기게 하는 것이었습니다. 이렇게 하면 모델은 git을 이용해 잘못된 코드 변경을 되돌리고, 코드베이스의 정상 동작 상태를 복구할 수 있습니다.

이 접근은 효율성도 높였습니다. agent가 무슨 일이 벌어졌는지 추측하느라 시간을 허비하거나, 기본 앱을 다시 살리는 데 시간을 쓰지 않아도 됐기 때문입니다.

### Testing

Anthropic이 관찰한 마지막 주요 실패 모드는, Claude가 충분한 테스트 없이 기능을 완료로 표시하는 경향이었습니다. 명시적으로 유도하지 않으면 Claude는 코드 변경을 하고, unit test나 개발 서버를 대상으로 한 `curl` 명령 같은 테스트도 수행하곤 했지만, 실제로는 기능이 end-to-end로 동작하지 않는다는 사실을 제대로 인식하지 못했습니다.

웹앱을 만드는 경우에는, 브라우저 자동화 도구를 쓰고 실제 사람 사용자처럼 테스트하라고 명시했을 때 Claude가 end-to-end 검증을 훨씬 잘 수행했습니다.

![Screenshots taken by Claude through the Puppeteer MCP server as it tested the claude.ai clone.](https://www-cdn.anthropic.com/images/4zrzovbb/website/f94c2257964fb2d623f1e81f874977ebfc0986bc-1920x1080.gif)

Claude가 `claude.ai` 클론을 테스트하면서 Puppeteer MCP 서버를 통해 촬영한 스크린샷.

이런 테스트 도구를 Claude에 제공하자 성능은 크게 개선됐습니다. agent가 코드만 봐서는 드러나지 않는 버그를 스스로 찾아내고 수정할 수 있었기 때문입니다.

다만 여전히 남는 문제가 있습니다. Claude의 vision 한계와 브라우저 자동화 도구의 제약 때문에 모든 종류의 버그를 식별하기는 어렵습니다. 예를 들어 Claude는 Puppeteer MCP를 통해서는 브라우저 네이티브 alert modal을 볼 수 없었고, 이런 modal에 의존하는 기능은 그만큼 버그가 더 많아지는 경향을 보였습니다.

## Getting up to speed

이런 장치들이 모두 갖춰진 뒤에는, 모든 coding agent가 현재 상황을 파악하기 위해 몇 가지 단계를 밟도록 프롬프트를 받습니다. 매우 기본적인 절차처럼 보이지만 여전히 큰 도움이 됩니다.

1. `pwd`를 실행해 현재 작업 디렉터리를 확인합니다. agent는 이 디렉터리 안의 파일만 수정할 수 있습니다.
2. git log와 progress 파일을 읽어 최근에 무엇이 작업됐는지 파악합니다.
3. features list 파일을 읽고, 아직 끝나지 않은 기능 가운데 우선순위가 가장 높은 항목을 골라 작업합니다.

이 접근은 Claude가 매 세션마다 테스트 방법을 새로 알아낼 필요가 없게 해주므로 token도 절약합니다. 또한 initializer agent가 개발 서버를 띄울 수 있는 `init.sh` 스크립트를 작성하게 하고, 새 기능 구현 전에 기본적인 end-to-end 테스트를 먼저 수행하게 하는 데도 도움이 됩니다.

`claude.ai` 클론의 경우, 이는 agent가 항상 로컬 개발 서버를 먼저 띄우고 Puppeteer MCP를 사용해 새 채팅을 시작하고, 메시지를 보내고, 응답을 받도록 만든다는 뜻이었습니다. 덕분에 Claude는 앱이 깨진 상태로 남겨졌는지 빠르게 확인할 수 있었고, 기존 버그가 있으면 즉시 수정할 수 있었습니다. 만약 곧바로 새 기능 구현에 들어갔다면, 문제를 더 악화시켰을 가능성이 큽니다.

이런 구성 아래에서 전형적인 세션은 대체로 아래와 같은 assistant 메시지로 시작됩니다.

```text
[Assistant] I'll start by getting my bearings and understanding the current state of the project.
[Tool Use] <bash - pwd>
[Tool Use] <read - claude-progress.txt>
[Tool Use] <read - feature_list.json>
[Assistant] Let me check the git log to see recent work.
[Tool Use] <bash - git log --oneline -20>
[Assistant] Now let me check if there's an init.sh script to restart the servers.
<Starts the development server>
[Assistant] Excellent! Now let me navigate to the application and verify that some fundamental features are still working.
<Tests basic functionality>
[Assistant] Based on my verification testing, I can see that the fundamental functionality is working well. The core chat features, theme switching, conversation loading, and error handling are all functioning correctly. Now let me review the tests.json file more comprehensively to understand what needs to be implemented next.
<Starts work on a new feature>
```

Agent failure modes and solutions

| Problem                                                                      | Initializer Agent Behavior                                                                                     | Coding Agent Behavior                                                                                                                                                           |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude declares victory on the entire project too early.                     | 입력 명세를 바탕으로 end-to-end feature description 목록이 들어 있는 구조화된 JSON feature list 파일을 만든다. | 세션 시작 시 feature list 파일을 읽고, 하나의 기능만 골라 작업을 시작한다.                                                                                                      |
| Claude leaves the environment in a state with bugs or undocumented progress. | 초기 git 저장소와 progress notes 파일을 작성한다.                                                              | 세션 시작 시 progress notes와 git commit log를 읽고, 개발 서버에서 기본 테스트를 실행해 문서화되지 않은 버그를 먼저 잡는다. 세션 종료 시 git commit과 progress update를 남긴다. |
| Claude marks features as done prematurely.                                   | feature list 파일을 만든다.                                                                                    | 모든 기능을 스스로 검증한다. 신중한 테스트를 마친 뒤에만 기능을 `"passing"`으로 표시한다.                                                                                       |
| Claude has to spend time figuring out how to run the app.                    | 개발 서버를 실행할 수 있는 `init.sh` 스크립트를 작성한다.                                                      | 세션 시작 시 `init.sh`를 읽는다.                                                                                                                                                |

long-running AI agent에서 자주 나타나는 네 가지 실패 모드와 대응 방안을 요약한 표입니다.

## Future work

이 연구는 long-running agent harness 안에서, 모델이 많은 context window를 건너가며 점진적인 진척을 만들게 하는 하나의 해법 세트를 보여줍니다. 하지만 여전히 열린 질문이 남아 있습니다.

가장 대표적인 질문은, 단일 범용 coding agent가 여러 context에서 가장 좋은 성능을 내는지, 아니면 multi-agent architecture를 통해 더 나은 성능을 얻을 수 있는지 아직 분명하지 않다는 점입니다. testing agent, quality assurance agent, code cleanup agent처럼 더 특화된 agent가 소프트웨어 개발 생명주기의 하위 작업을 더 잘 처리할 가능성은 충분히 있습니다.

또한 이 데모는 full-stack 웹앱 개발에 최적화돼 있습니다. 앞으로의 방향은 이런 발견을 다른 분야에도 일반화하는 일입니다. 예를 들어 과학 연구나 금융 모델링처럼 long-running agentic task가 필요한 영역에도, 여기서 얻은 교훈의 일부 또는 전부를 적용할 수 있을 가능성이 큽니다.

### Acknowledgements

이 글은 Justin Young이 작성했습니다. David Hershey, Prithvi Rajasakeran, Jeremy Hadfield, Naia Bouscal, Michael Tingley, Jesse Mu, Jake Eaton, Marius Buleandara, Maggie Vo, Pedram Navid, Nadine Yasser, Alex Notov의 기여에도 감사드립니다.

이 작업은 Anthropic 내 여러 팀이 함께 만든 결과물이며, 특히 code RL 팀과 Claude Code 팀 덕분에 Claude가 long-horizon 자율 소프트웨어 엔지니어링을 안전하게 수행할 수 있었습니다. 이 작업에 기여하고 싶은 분은 [anthropic.com/careers](https://www.anthropic.com/careers)에서 지원할 수 있습니다.

### Footnotes

[^1]: 여기서 이들을 separate agent라고 부르는 이유는 초기 user prompt가 서로 달랐기 때문입니다. system prompt, 도구 집합, 전체 agent harness는 그 밖에는 동일했습니다.
