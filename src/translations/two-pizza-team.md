---
title: Two Pizza Team
date: 2025-12-03
---

- 원문은 [마틴 파울러의 원 글](https://martinfowler.com/bliki/TwoPizzaTeam.html)을 확인해주세요.

## 개요

 Two Pizza Team은 특정 비즈니스 역량을 책임지고 소프트웨어를 처음부터 끝까지 돌보는 작은 팀을 뜻합니다. Amazon이 소프트웨어 조직을 꾸릴 때 썼던 방식으로 널리 알려졌으며, 한 팀이 피자 두 판으로 배를 채울 수 있을 정도로만 구성돼야 한다는 이미지에서 이름이 왔습니다. (여기서 말하는 피자는 마틴 파울러가 처음 보고 놀랐던 미국식 대형 피자를 가리킵니다.)

## 팀 규모와 응집력

Martin Fowler는 이런 팀이 5~8명 정도, 많아도 15명을 넘기지 않아야 긴밀한 협업 관계를 유지할 수 있다고 설명합니다. 팀이 작을수록 서로의 업무 맥락을 잘 공유할 수 있고, 복잡한 커뮤니케이션 구조가 생기지 않습니다.

## 팀의 초점과 역할

 Two Pizza Team의 핵심은 규모뿐 아니라 초점입니다. 팀은 고객이 필요로 하는 가치를 파악하고, 실험하면서 빠르게 소프트웨어로 구현하며, 다른 팀에 대한 의존과 핸드오프를 최소화할 만큼 필요한 역량을 팀 내부에 모두 갖춘 채 고객 상황이 바뀌면 제품도 함께 발전시켜야 합니다.

## 결과 중심 문화

 이 팀들은 [Outcome Oriented](https://martinfowler.com/bliki/OutcomeOriented.html)이며 [Activity Oriented](https://martinfowler.com/bliki/ActivityOriented.html) 구조와 다릅니다. 즉 데이터베이스, 테스트, 운영처럼 기능별로 사람을 나누지 않고 고객 가치를 내는 데 필요한 역량을 팀 내부에서 모두 갖춥니다. 덕분에 기능 아이디어가 production 환경에 배포되기까지의 cycle time(기능 아이디어가 실제 프로덕션에서 실행되기까지 걸리는 시간)을 최소화할 수 있습니다. 또한 “you build it, you run it” 원칙에 따라 운영 중 장애가 나면 스스로 책임지고 복구하며, 필요하다면 야간이나 비근무 시간에도 직접 대응해야 합니다.

## 장수하는 제품 지향 팀

Two Pizza Team은 프로젝트가 끝나면 해체되는 것이 아니라 [Business Capability Centric](https://martinfowler.com/bliki/BusinessCapabilityCentric.html) 팀으로 오래 유지됩니다. 자신들이 담당하는 capability를 하나의 product라고 보고, [Products over Projects](https://martinfowler.com/articles/products-over-projects.html) 관점에서 계속 기능을 확장하고 품질을 관리하는 Product Team의 정체성을 가집니다.

## 플랫폼 지원 필요성

이렇게 폭넓은 역할을 수행하려면 탄탄한 software platform이 필요합니다. 소규모 조직은 상용 클라우드 플랫폼을 활용할 수 있지만, 대규모 조직은 내부 플랫폼을 만들어 공통 도구와 인프라를 제공합니다. [Team Topologies](https://martinfowler.com/bliki/TeamTopologies.html)에서 말하는 stream-aligned teams 관점을 적용하면 이런 팀과 플랫폼 팀 사이의 상호작용을 설계하는 데 도움이 됩니다.

## 팀 간 협업과 API

업무 역량 중심 팀은 서로의 capability를 사용해야 하므로, 동료 팀을 위해 API와 같은 명확한 인터페이스를 제공해야 합니다. 이 부분을 소홀히 하면 정보가 팀 안에만 갇혀 사일로가 생기고 조직 전체 속도가 급격히 떨어집니다.

## 소프트웨어 구조와 콘웨이의 법칙

[콘웨이의 법칙](https://martinfowler.com/bliki/ConwaysLaw.html)에 따르면 조직 구조는 소프트웨어 구조에 그대로 반영됩니다. 따라서 Two Pizza Team이 맡은 컴포넌트 역시 서로 잘 정의된 API로 연결돼야 합니다. 이런 사고방식이 [microservices](https://martinfowler.com/microservices/) 아키텍처로 이어졌지만, 항상 정답은 아니며 단일 모놀리식 런타임 안에서도 구성 요소를 잘 나누면 충분히 효과적인 대안이 될 수 있습니다.
