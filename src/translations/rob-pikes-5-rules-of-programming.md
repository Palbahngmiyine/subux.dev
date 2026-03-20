---
title: Rob Pike's 5 Rules of Programming
date: 2026-03-20
---

- 원문은 [원 글](https://www.cs.unc.edu/~stotts/COMP590-059-f24/robsrules.html)을 확인해주세요.

Rob Pike는 프로그래밍에서 성능, 알고리즘, 데이터 구조를 다루는 태도를 아래 다섯 가지 규칙으로 정리했습니다.

1. Rule 1. 프로그램이 실제로 어디에서 시간을 쓰게 될지는 미리 알 수 없습니다. 병목은 뜻밖의 곳에서 생기므로, 병목이 바로 그 지점이라는 사실을 확인하기 전에는 추측만으로 성능 최적화 꼼수를 넣지 말아야 합니다.
2. Rule 2. 측정하세요. 측정하기 전에는 속도를 위해 코드를 다듬지 말고, 측정한 뒤에도 코드의 한 부분이 나머지를 압도할 정도가 아니라면 굳이 튜닝하지 말아야 합니다.
3. Rule 3. 그럴듯해 보이는 복잡한 알고리즘은 n이 작을 때 느리고, 대개 n은 작습니다. 그런 알고리즘은 상수 비용도 큽니다. n이 자주 커진다는 사실을 알기 전까지는 괜히 복잡하게 만들지 마세요. n이 정말 커진다 해도 먼저 Rule 2를 적용해야 합니다.
4. Rule 4. 복잡한 알고리즘은 단순한 알고리즘보다 버그가 더 많고 구현도 훨씬 어렵습니다. 알고리즘뿐 아니라 데이터 구조도 단순하게 유지해야 합니다.
5. Rule 5. 데이터가 핵심입니다. 올바른 데이터 구조를 고르고 구조를 잘 정리해두면, 알고리즘은 대개 거의 자명하게 드러납니다. 프로그래밍의 중심은 알고리즘이 아니라 데이터 구조입니다.

Pike의 Rule 1과 Rule 2는 Tony Hoare의 유명한 격언인 "성급한 최적화는 모든 악의 근원이다(Premature optimization is the root of all evil.)"를 다시 풀어쓴 것입니다.

Ken Thompson은 Pike의 Rule 3과 Rule 4를 "확신이 서지 않으면 무식하게 밀어붙여라(When in doubt, use brute force.)"라고 바꿔 말했습니다.

Rule 3과 Rule 4는 KISS(Keep It Simple, Stupid)라는 설계 철학의 사례이기도 합니다.

Rule 5는 앞서 Fred Brooks가 《The Mythical Man-Month》에서 이야기한 바 있습니다. 또한 Rule 5는 흔히 "똑똑한 객체를 쓰고 코드는 단순하게 작성하라(write stupid code that uses smart objects)"로 줄여 말하기도 합니다.
