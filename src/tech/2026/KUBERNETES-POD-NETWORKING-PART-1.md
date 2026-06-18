---
title: Kubernetes Pod 네트워킹 이해하기 1부: Pod, Service, DNS
date: 2026-06-18
---

최근 쿠버네티스 동작 원리에 대해 이야기를 할 기회가 있었는데, 쿠버네티스 자체에
대한 사용법은 알고 있어도 내부 네트워킹 원리에는 무심했다는 걸 깨달아 글로
정리해보려고 합니다.

쿠버네티스에서 애플리케이션을 배포하다 보면 Deployment와 Service 매니페스트를
작성하고, `kubectl`로 상태를 확인하는 일에는 금방 익숙해집니다. 하지만 실제 요청이
한 Pod에서 다른 Pod로 이동할 때 어떤 이름을 거치고, 어떤 IP로 바뀌며, 어느
컴포넌트가 그 연결을 준비하는지는 눈에 잘 보이지 않습니다.

1부에서는 애플리케이션이 직접 마주하는 Pod 네트워킹과 Service 기반 통신을
정리합니다. CNI가 Pod IP와 노드 간 경로를 실제로 어떻게 구성하는지는 2부에서
이어서 다루겠습니다.

## 개요

Kubernetes에서 Pod끼리는 기본적으로 IP로 직접 통신할 수 있습니다. 하지만 운영
코드가 Pod IP를 직접 기억하면 안 됩니다. Pod는 재시작되거나 스케일링되면서 계속
바뀔 수 있기 때문입니다.

이 글에서는 같은 네임스페이스의 `frontend`와 `backend`를 예시로 사용합니다.
여기서 `frontend`는 브라우저 안에서 실행되는 JavaScript 코드가 아니라,
클러스터 안에서 요청을 받는 프론트엔드 서버, SSR 서버, BFF, 또는 API 프록시 Pod를
뜻합니다. 사용자는 공개 도메인의 프론트엔드 페이지로 들어오고, 브라우저 앱은 공개
주소의 API 경로를 호출합니다. 그 요청을 받은 클러스터 안의 `frontend` Pod가 필요한
데이터를 가져오기 위해 `backend` Service 이름으로 backend Pod들을 호출합니다.

이 흐름은 세 단계로 나눠서 보면 이해하기 쉽습니다.

- 같은 Pod 안의 컨테이너는 같은 네트워크 네임스페이스를 공유합니다.
- 다른 Pod끼리는 Pod IP로 직접 통신할 수 있지만, 서비스 간 통신에는 Service
  이름을 사용합니다.
- Service 이름은 DNS를 통해 ClusterIP로 해석되고, 노드의 패킷 처리 규칙을 거쳐
  현재 요청을 받을 수 있는 backend Pod로 전달됩니다.

이 글에서는 `frontend`가 `backend` Service 이름으로 요청했을 때, 그 요청이 실제
backend Pod까지 어떻게 도달하는지 알아보겠습니다.

## 같은 Pod 안의 컨테이너끼리 통신하기

Kubernetes의 Pod는 하나 이상의 컨테이너를 담는 가장 작은 배포 단위입니다.
같은 Pod 안의 컨테이너들은 같은 네트워크 네임스페이스를 공유합니다.
네트워크 네임스페이스는 IP 주소, 포트, 라우팅 정보를 담는 격리된 네트워크
공간입니다.

그래서 같은 Pod 안에서는 다음이 성립합니다.

- 모든 컨테이너가 같은 Pod IP를 봅니다.
- 포트 공간도 공유합니다.
- 서로 `localhost`로 통신할 수 있습니다.

예를 들어 한 Pod 안에 `nginx` 컨테이너와 `curl` 컨테이너가 있고, `nginx`가
80번 포트에서 listen 중이라면 `curl` 컨테이너는 다음 명령으로 접근할 수 있습니다.

```bash
curl http://localhost:80
```

두 컨테이너는 프로세스로는 분리되어 있지만, 네트워크에서는 같은 주소와 같은 포트
공간을 공유합니다.

주의할 점도 있습니다. 포트 공간을 공유하므로 같은 Pod 안의 두 컨테이너가
동시에 `0.0.0.0:80`에 바인딩하려고 하면 충돌합니다.

## 다른 Pod끼리 직접 통신하기

다른 Pod는 각자 다른 Pod IP를 가집니다. Kubernetes 네트워크 모델은
기본적으로 Pod들이 노드가 달라도 서로 통신할 수 있다고 가정합니다.

예를 들어 `frontend` Pod가 `backend` Pod의 IP를 알고 있다면, 이론적으로는
다음 요청을 보낼 수 있습니다.

```bash
curl http://10.244.1.23:80
```

학습이나 임시 디버깅에는 이런 접근이 유용할 수 있습니다. 하지만 운영
코드에 이렇게 Pod IP를 박아 넣으면 안 됩니다.

- Pod가 재시작되면 IP가 바뀔 수 있습니다.
- Deployment가 스케일 아웃되면 backend Pod가 여러 개가 됩니다.
- 장애가 난 Pod를 제외하고 정상 Pod로 보내야 합니다.
- 다른 네임스페이스나 네트워크 정책까지 고려해야 합니다.

Pod IP가 바뀌는 문제를 해결하는 Kubernetes 객체가 Service입니다.

## Service 기반 통신 한눈에 보기

앞의 예시를 Service 관점에서 펼치면 아래와 같습니다. 클러스터 안의 `frontend`
서버나 프록시 Pod는 요청을 보내는 클라이언트이고, `backend` Service는
`app=backend` label을 가진 backend Pod들 앞의 안정적인 진입점입니다. Service
종류는 클러스터 내부 통신에서 기본으로 쓰는 `ClusterIP`입니다.

실제 서비스에서 브라우저나 모바일 앱이 `http://backend:80`을 직접 호출하지는
않습니다. `backend`는 클러스터 내부 DNS 이름이기 때문입니다. 엔드 유저는 보통
공개 도메인의 프론트엔드 페이지로 접근합니다.

```text
https://www.example.com/orders
```

이때 공개 DNS는 `www.example.com`을 외부 로드밸런서 같은 진입점으로 해석합니다.
브라우저에서 실행되는 프론트엔드 앱은 같은 origin의 `/api/orders`나
`https://api.example.com/orders` 같은 공개 API 주소를 호출합니다. 그 요청은
로드밸런서, Ingress Controller, API Gateway 같은 진입 계층을 거쳐 클러스터 안의
프론트엔드 서버, BFF, 또는 API 프록시 Pod까지 들어옵니다. 그다음 클러스터 안의
Pod가 페이지에 필요한 데이터를 준비하기 위해 `backend` Service 이름으로 내부
요청을 보낼 수 있습니다.

```text
엔드 유저 요청: GET https://www.example.com/orders
브라우저 앱의 API 요청: GET https://www.example.com/api/orders
클러스터 내부 요청: frontend 서버/BFF/API 프록시 Pod -> GET http://backend:80/orders
```

여기서 `backend`는 외부 도메인이 아니라 Service 이름입니다. `frontend` Pod와
`backend` Service가 같은 네임스페이스에 있으면, Pod 안의 DNS 설정은 짧은 이름
`backend`를 같은 네임스페이스의 Service로 찾습니다.

예를 들어 둘 다 `default` 네임스페이스에 있다면 `backend`는
`backend.default.svc.cluster.local`로 해석될 수 있습니다. 이 이름은
`default` 네임스페이스의 `backend` Service를 뜻합니다. `svc`는 Service용 DNS
영역이고, `cluster.local`은 클러스터 내부 DNS 도메인입니다.

즉 클러스터 안의 서버 코드나 프록시가 `http://backend:80`으로 요청하면, 먼저
`backend` Service의 ClusterIP를 찾고 그 ClusterIP의 80번 포트로 연결을
시도합니다.

아래 흐름에서 endpoint는 요청을 실제로 받을 목적지입니다. 일반적인 Service에서는
`PodIP:targetPort` 조합이 endpoint가 됩니다.

```text
[엔드 유저: 브라우저 / 모바일 앱]
      |
      | GET https://www.example.com/orders
      v
[공개 DNS]
      |
      | www.example.com -> 외부 진입점
      v
[외부 로드밸런서 / Ingress Controller / API Gateway]
      |
      | 브라우저의 /api/orders 요청을 클러스터 안으로 전달
      v
[frontend 서버 / BFF / API 프록시 Pod: default namespace]
      |
      | 페이지 처리 중 주문 데이터가 필요함
      |
      | 내부 요청: GET http://backend:80/orders
      v
[Kubernetes DNS: CoreDNS]
      |
      | backend -> backend.default.svc.cluster.local -> Service ClusterIP
      v
[Service: backend]
ClusterIP: 10.96.30.100
Port: 80
      |
      | 노드 dataplane 규칙이 endpoint 중 하나로 전달
      v
[EndpointSlice]
10.244.1.10:80
10.244.1.11:80
10.244.2.20:80
      |
      v
[backend Pod]
```

위 흐름을 문장으로 압축하면 다음과 같습니다.

1. 브라우저나 모바일 앱이 공개 도메인의 프론트엔드 페이지(`/orders`)를 요청합니다.
2. 브라우저 앱은 같은 origin의 `/api/orders`나 공개 API 도메인으로 데이터를 요청합니다.
3. 공개 DNS와 외부 진입 계층이 API 요청을 클러스터 안의 프론트엔드 서버, BFF,
   또는 API 프록시 Pod로 전달합니다.
4. 그 Pod는 페이지 처리에 필요한 데이터를 가져오기 위해 `http://backend:80/orders`로
   내부 요청을 보냅니다.
5. 클러스터 DNS는 `backend`를 Service의 ClusterIP로 해석합니다.
6. kube-proxy 또는 대체 dataplane이 준비한 노드 규칙은 ClusterIP로 온 패킷을
   현재 요청을 받을 수 있는 backend Pod 중 하나로 전달합니다.

이 흐름은 두 가지 질문을 통해 알아봅시다. 첫 번째는 Service 이름으로 요청할 때
네트워크에서 어떤 일이 일어나는지이고, 두 번째는 Service의 selector를 기준으로
backend Pod 목록이 어떻게 만들어지는지입니다.

## Service 이름으로 통신할 때 일어나는 일

먼저 첫 번째 흐름입니다. "Service 이름으로 통신한다"는 말은 클러스터 안의
애플리케이션이 Kubernetes API를 직접 호출한다는 뜻이 아닙니다. Pod 안에서 실행되는
서버 코드나 프록시가 평범한 HTTP 요청을 보낸다는 뜻입니다.

앞의 흐름에서 엔드 유저 요청은 이미 공개 도메인의 프론트엔드 페이지로 들어왔고,
브라우저 앱은 공개 API 경로로 데이터를 요청했습니다. Service 이름은 그 다음 단계에서
쓰입니다. 클러스터 안의 프론트엔드 서버, BFF, 또는 API 프록시 Pod가 backend로
요청을 넘길 때 다음과 같은 내부 요청을 만듭니다.

```text
GET http://backend:80/orders
```

먼저 전체 흐름을 압축하면 다음과 같습니다.

```text
1. Pod 안의 서버 코드나 프록시가 backend라는 호스트 이름으로 TCP 연결을 열려고 한다.
2. Pod 안의 DNS resolver가 backend를 DNS 이름으로 해석하려고 한다.
3. Pod의 /etc/resolv.conf에 있는 search domain 때문에 backend가
   backend.<namespace>.svc.cluster.local 같은 이름으로 확장된다.
4. DNS 질의가 클러스터 DNS Service로 전송된다.
5. CoreDNS가 Kubernetes API의 Service 정보를 보고
   backend Service의 ClusterIP를 응답한다.
6. 서버 코드나 프록시는 ClusterIP:80으로 TCP 연결을 시도한다.
7. 요청 패킷이 노드에 도착하면 kube-proxy 또는 대체 dataplane 규칙이
   ClusterIP:80을 실제 backend Pod IP:targetPort로 변환한다.
8. 클러스터의 Pod 네트워크 경로를 따라 패킷이 backend Pod IP까지 전달된다.
9. backend Pod의 컨테이너가 요청을 받는다.
```

DNS resolver는 클러스터 안의 서버 코드나 프록시가 사용한 이름을 IP 주소로 바꾸는
역할을 합니다. Kubernetes는 Pod 안의 DNS 설정을 구성해 두고, 그 설정을 통해
`backend` 같은 짧은 Service 이름도 해석되게 만듭니다.

이제 같은 흐름을 컴포넌트별 책임으로 나누어 보겠습니다.

### 1. 서버 코드는 Service 객체를 직접 조회하지 않는다

클러스터 안의 서버 코드나 프록시는 `http://backend:80`이라는 주소로 연결을
시도합니다. 이 코드는 Service 객체를 읽지 않고, EndpointSlice도 조회하지 않습니다.
Kubernetes API를 직접 호출하지도 않습니다. Service 조회와 endpoint 선택은
Kubernetes 내부 컴포넌트가 맡고, 서버 코드나 프록시는 네트워크 클라이언트 역할만
합니다.

### 2. Pod의 DNS 설정이 Service 이름을 확장한다

kubelet은 Pod를 만들 때 Pod 안의 `/etc/resolv.conf`를 구성합니다. 이 파일에는
DNS 서버 주소와 search domain이 들어 있습니다.

같은 네임스페이스에 `backend` Service가 있다면, 클러스터 안의 서버 코드나
프록시는 짧은 이름인 `backend`만 사용할 수 있습니다. Pod의 DNS resolver는 이 이름을
`backend.<namespace>.svc.cluster.local` 같은 Service DNS 이름으로 확장합니다.

### 3. CoreDNS가 ClusterIP를 응답한다

현재 Kubernetes 클러스터 DNS는 일반적으로 CoreDNS가 맡습니다. 일부 클러스터에서
CoreDNS 앞의 Service 이름이 `kube-dns`인 것은 레거시 Service 이름과의 호환을
위한 설정입니다.

CoreDNS는 Kubernetes API를 통해 Service 정보를 알고 있습니다. 일반적인
ClusterIP Service라면 DNS 응답의 A 레코드는 backend Pod IP가 아니라 Service의
ClusterIP입니다.

Headless Service는 다르게 동작합니다. Headless Service는 ClusterIP를 갖지
않으므로 DNS 응답이 Pod IP 목록이 될 수 있습니다.

### 4. kube-proxy 또는 dataplane이 ClusterIP를 endpoint로 연결한다

DNS가 응답한 ClusterIP는 실제 Pod의 IP가 아닙니다. ClusterIP는 Service를
대표하는 가상 IP입니다. 이 IP로 보낸 패킷은 노드의 dataplane 규칙을 거쳐
실제 endpoint Pod로 전달됩니다.

kube-proxy는 Service와 EndpointSlice의 변경을 Kubernetes API 서버에서 계속
관찰합니다. Kubernetes에서는 이런 변경 관찰을 watch라고 부릅니다. kube-proxy는
`backend` Service의 ClusterIP와 현재 endpoint Pod 목록을 바탕으로 노드의 패킷
처리 규칙을 구성합니다. iptables 모드에서는 목적지 주소 변환, 즉 DNAT 규칙으로
`ClusterIP:port`를 `PodIP:targetPort`로 바꿉니다.

nftables 모드에서도 구체적인 구현은 다르지만 목적은 같습니다. kube-proxy가
노드에 Service용 패킷 처리 규칙을 만들고, 그 규칙이 Service의 가상 주소로 온
패킷을 현재 endpoint 중 하나로 보냅니다. IPVS 모드는 과거에 성능 개선을 위해
쓰이던 kube-proxy 구현이지만, Kubernetes v1.35부터 deprecated 상태입니다. 새로
흐름을 이해할 때는 iptables와 nftables처럼 kube-proxy가 노드 규칙을 만든다는 점에
집중하면 됩니다.

Cilium 같은 eBPF 기반 네트워킹 구현은 kube-proxy를 대체해 dataplane에서
Service 처리를 할 수 있습니다. 여기서 dataplane은 실제 네트워크 패킷을 처리하는
계층을 뜻합니다. 구현은 달라도 역할은 같습니다. Service의 가상 주소로 온 패킷을
현재 endpoint 중 하나로 전달합니다.

기존 연결과 새 연결은 구분해야 합니다. DNS 해석과 endpoint 선택은 새
연결을 만들 때 중요합니다. 이미 열린 TCP 연결은 같은 연결의 패킷들이
일관되게 처리되도록 conntrack 같은 커널의 연결 추적 기능의 영향을 받습니다.
새 Pod가 추가되어도 이미 열린 연결이 자동으로 그 Pod로 옮겨지지는 않습니다.

## Service 객체는 무엇을 선언할까?

이제 두 번째 흐름으로 넘어가겠습니다. Service는 Pod 집합을 대표하는 안정적인
네트워크 API 객체입니다. 여러 애플리케이션 인스턴스 앞에 붙는 내부용 진입점으로
이해할 수 있습니다. 다만 Service 객체 자체가 요청을 처리하는 서버 프로세스는
아닙니다. Kubernetes API에 저장된 네트워크 설정이고, DNS, EndpointSlice,
kube-proxy 또는 다른 dataplane이 그 설정을 실제 패킷 흐름으로 바꿉니다.

가장 기본적인 Service는 이런 모양입니다.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: backend
spec:
  type: ClusterIP
  selector:
    app: backend
  ports:
    - name: http
      protocol: TCP
      port: 80
      targetPort: 80
```

각 필드를 풀어 보면 이렇습니다.

- `metadata.name`: Service의 이름입니다. 같은 네임스페이스 안에서는
  `backend`라는 DNS 이름으로 접근할 수 있습니다.
- `spec.type`: Service 종류입니다. 생략하면 기본값은 `ClusterIP`입니다.
  클러스터 내부 Pod 간 통신에서는 `ClusterIP`가 기본 Service 종류입니다.
- `spec.selector`: 어떤 Pod를 backend로 삼을지 고르는 조건입니다.
  위 예시는 `app=backend` label을 가진 Pod를 고릅니다.
- `ports[].port`: 클라이언트가 Service에 접근할 때 쓰는 포트입니다.
- `ports[].targetPort`: 실제 backend Pod 컨테이너가 listen하는 포트입니다.
- `ports[].protocol`: TCP, UDP, SCTP 중 어떤 프로토콜인지 나타냅니다.
  기본은 TCP입니다.

### 번외: ClusterIP는 누가 할당할까?

`type: ClusterIP` Service를 만들 때 `spec.clusterIP`를 직접 쓰지 않으면,
Kubernetes가 Service IP 대역에서 비어 있는 IP를 하나 고릅니다. 이 대역은 API
서버의 `--service-cluster-ip-range` 설정으로 정해집니다.

생성 흐름은 다음처럼 볼 수 있습니다.

```text
1. 사용자가 clusterIP를 비워 둔 Service 매니페스트를 적용한다.
2. kubectl이 Kubernetes API 서버에 Service 생성 요청을 보낸다.
3. API 서버는 Service IP 대역에서 사용 가능한 IP를 고른다.
4. API 서버는 그 값을 Service 객체의 spec.clusterIP에 저장한다.
5. CoreDNS와 kube-proxy 또는 대체 dataplane은 이 Service 객체 값을 관찰해 사용한다.
```

예를 들어 Service 생성 뒤에는 객체 상태에 다음 값이 생길 수 있습니다.

```yaml
spec:
  clusterIP: 10.96.30.100
```

이 IP는 노드의 실제 네트워크 인터페이스에 붙는 IP가 아닙니다. Kubernetes API에
저장된 Service의 가상 IP입니다. Service 객체는 이 가상 IP와 port 규칙을 선언하고,
실제 패킷 처리는 kube-proxy나 Cilium 같은 dataplane이 맡습니다.

Headless Service처럼 `clusterIP: None`을 명시하면 ClusterIP를 할당하지 않습니다.
또 특별한 이유가 있으면 `spec.clusterIP`를 직접 지정할 수도 있지만, Service IP
대역 안의 충돌 없는 주소여야 하므로 일반적인 애플리케이션 Service에서는 비워 두는
편이 안전합니다.

## Service는 backend Pod를 어떻게 알까?

Service가 어떤 Pod로 요청을 보낼지는 Service의 `selector`와 Pod의 `label`로
결정됩니다. 이 연결 관계는 네트워크 스캔으로 만들어지지 않습니다. Kubernetes API
서버에 저장된 객체 상태를 기준으로 계산됩니다. label은 Kubernetes 객체에 붙이는
key-value 메타데이터이고, selector는 그 label 값을 기준으로 객체를 고르는
조건입니다.

예를 들어 backend Deployment가 다음 label을 가진 Pod를 만든다고 해 보겠습니다.

```yaml
metadata:
  labels:
    app: backend
```

그리고 Service가 다음 selector를 가진다면, 이 Service의 endpoint 대상은
`app=backend` label을 가진 Pod들입니다.

```yaml
spec:
  selector:
    app: backend
```

Service와 EndpointSlice 생성 흐름은 다음과 같습니다. 여기서 controller는 Kubernetes
객체의 현재 상태를 계속 관찰하고, 사용자가 선언한 원하는 상태에 맞게 다른 객체를
만들거나 갱신하는 컴포넌트입니다. 한 controller가 모든 일을 직접 처리하는 것이
아니라, 여러 controller가 각자 맡은 객체를 유지합니다.

```text
1. 사용자가 Deployment와 Service 매니페스트를 적용한다.
2. kubectl이 Kubernetes API 서버에 생성 또는 변경 요청을 보낸다.
3. API 서버는 Deployment와 Service 객체를 저장한다.
4. ClusterIP Service라면 API 서버가 Service IP 대역에서 ClusterIP를 할당해 저장한다.
5. Deployment controller는 Deployment의 Pod template을 기준으로 ReplicaSet을 만든다.
6. ReplicaSet controller는 ReplicaSet이 원하는 replica 수에 맞게 Pod 객체를 만든다.
7. 이 Pod들은 template에 적힌 app=backend label을 가진다.
8. Pod가 노드에 배치되고 네트워크가 준비되면 Pod IP가 할당된다.
9. EndpointSlice controller는 backend Service의 selector인 app=backend를 읽는다.
10. 같은 네임스페이스에서 app=backend label을 가진 Pod들을 찾는다.
11. 요청을 받을 수 있는 Pod의 Pod IP와 targetPort를 모아 EndpointSlice를 갱신한다.
12. kube-proxy는 Kubernetes API 서버에서 Service와 EndpointSlice 변경을 관찰한다.
13. kube-proxy는 각 노드의 dataplane 규칙을 갱신한다.
14. 클라이언트 Pod가 Service ClusterIP로 패킷을 보내면 노드 dataplane이 endpoint Pod로 전달한다.
```

즉 Service가 직접 Pod에 접속해서 backend 여부를 확인하는 구조가 아닙니다.
Service는 selector를 선언하고, Kubernetes 컨트롤 플레인(control plane)의
컨트롤러들이 현재 객체 상태를 보고 EndpointSlice를 유지합니다. 컨트롤 플레인은
클러스터의 원하는 상태와 실제 상태를 맞추는 Kubernetes 관리 컴포넌트들의
묶음입니다. kube-proxy는 그 결과를 노드의 패킷 처리 규칙으로 반영합니다.

EndpointSlice 기반 구조에서는 다음과 같은 일이 생깁니다.

- Pod가 새로 생기면 label이 Service selector와 맞는지 평가되고,
  조건이 맞으면 EndpointSlice에 추가됩니다.
- Pod가 삭제되면 EndpointSlice에서 제거됩니다.
- Pod가 ready 상태가 아니면 요청을 받을 준비가 되지 않은 것으로 보고, 일반적인
  Service 트래픽의 endpoint로 쓰이지 않을 수 있습니다.
- Service selector가 Pod label과 맞지 않으면 Service는 존재하지만 보낼
  endpoint가 없습니다.

그래서 Service 문제를 디버깅할 때는 Service 자체만 보면 부족합니다.
Service의 selector, Pod label, Pod readiness, EndpointSlice를 함께 봐야 합니다.

앞에서 본 `10.96.30.100` 같은 ClusterIP는 Service 객체에 저장된 가상 IP입니다.
노드의 실제 네트워크 인터페이스에 붙는 IP가 아닙니다. 이 ClusterIP로 패킷이 가면,
노드의 dataplane 규칙이 그 패킷을 EndpointSlice의 실제 `PodIP:targetPort` 중
하나로 전달합니다.

Service 객체가 "Pod를 골라서 직접 프록시한다"라고 이해하면 정확하지 않습니다.
Service는 안정적인 이름과 가상 IP를 제공합니다. 실제 패킷 전달은 kube-proxy가
만드는 iptables/nftables 규칙이나, Cilium 같은 eBPF 기반 네트워킹 구현이 제공하는
dataplane이 담당합니다. 어떤 방식인지는 클러스터 구성에 따라 달라집니다.

## ClusterIP와 Headless Service

지금까지의 흐름은 일반적인 ClusterIP Service를 기준으로 설명했습니다. 클러스터
내부 Pod 간 통신에서는 ClusterIP Service를 중심으로 이해하면 됩니다.

- `ClusterIP`: 클러스터 내부에서만 접근하는 기본 Service입니다. 내부
  서비스 간 통신의 기본 선택지입니다.
- `Headless Service`: `clusterIP: None`으로 만듭니다. 일반 Service와 달리 하나의
  ClusterIP로 모으지 않고, DNS가 backend Pod IP들을 직접 돌려줍니다.
  StatefulSet 같은 특정 사용 사례에서 씁니다.

## DNS: IP 대신 이름을 쓰게 해 주는 장치

앞에서는 `backend`가 같은 네임스페이스의 Service 이름으로 해석될 수 있다고
봤습니다. 여기서는 Kubernetes가 Service DNS 이름을 어떤 형식으로 만드는지
정리합니다. 일반적인 Service는 다음 형식의 이름을 가집니다.

```text
<service-name>.<namespace>.svc.<cluster-domain>
```

예를 들어 `default` 네임스페이스의 `backend` Service는 다음 이름으로
접근할 수 있습니다.

```text
backend.default.svc.cluster.local
```

이 이름은 임의로 붙인 문자열이 아닙니다. Kubernetes는 Service가 네임스페이스
범위의 객체라는 점을 DNS 이름에도 반영합니다. 그래서 Service 이름만 쓰지 않고,
Service가 속한 네임스페이스를 함께 넣습니다. 여기에 Service 레코드임을 나타내는
`svc` 영역과 클러스터 DNS 도메인을 붙여
`<service-name>.<namespace>.svc.<cluster-domain>` 형태가 됩니다.

이 구조 덕분에 `default` 네임스페이스의 `backend`와 `prod` 네임스페이스의
`backend`를 서로 다른 DNS 이름으로 구분할 수 있습니다. 클러스터 도메인은 설정으로
바꿀 수 있으므로 모든 클러스터가 반드시 `cluster.local`을 쓰는 것은 아닙니다.

다음 명령은 같은 네임스페이스의 임시 디버깅 Pod나 다른 서버 Pod 안에서 Service DNS가 해석되는지
확인할 때 쓰는 명령입니다.

```bash
curl http://backend:80
```

다른 네임스페이스에서 확인한다면 네임스페이스를 명시하는 편이 안전합니다.

```bash
curl http://backend.default.svc.cluster.local:80
```

DNS가 돌려주는 값도 Service 종류에 따라 다릅니다. 일반 ClusterIP Service는
Service의 ClusterIP로 해석됩니다. Headless Service는 선택된 Pod IP 집합으로
해석됩니다.

## EndpointSlice: Service 뒤의 실제 목적지 목록

DNS가 Service의 ClusterIP를 알려 주더라도, 최종 목적지는 실제 backend Pod입니다.
EndpointSlice는 Service 뒤에 있는 실제 네트워크 endpoint를 담는 객체입니다.
일반적인 endpoint는 Pod IP와 port입니다.

다음 명령으로 확인할 수 있습니다.

```bash
kubectl get endpointslice \
  -l kubernetes.io/service-name=backend \
  -o wide
```

Service selector가 잘못되었거나 Pod가 ready 상태가 아니면 EndpointSlice가
비어 있을 수 있습니다. EndpointSlice가 비어 있으면 DNS는 Service 이름을
ClusterIP로 해석하더라도 실제 요청은 실패할 수 있습니다.

## Deployment와 Service 예제

마지막으로 지금까지의 흐름을 만드는 최소 YAML을 보겠습니다. 아래 예제는
`backend` Deployment 3개 replica와 그 앞의 ClusterIP Service를 만듭니다.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
        - name: backend
          image: nginx:1.27
          ports:
            - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: backend
spec:
  type: ClusterIP
  selector:
    app: backend
  ports:
    - name: http
      protocol: TCP
      port: 80
      targetPort: 80
```

이 YAML을 적용한다고 해서 브라우저가 곧바로 `http://backend:80`을 호출하는 것은
아닙니다. 일반적인 웹 흐름에서는 브라우저 앱이 공개 API 경로를 호출하고, 클러스터
안의 서버나 프록시가 그 요청을 내부 Service 호출로 이어 줍니다.

```text
브라우저 앱
  -> GET /api/orders
  -> 공개 도메인 또는 공개 API 도메인
  -> Ingress Controller / API Gateway
  -> frontend 서버 / BFF / API 프록시 Pod
  -> GET http://backend:80/orders
  -> backend Service
  -> backend Pod
```

같은 네임스페이스의 임시 디버깅 Pod 안에서 Service DNS를 확인할 때는 다음처럼
짧은 이름을 사용할 수 있습니다.

```bash
curl http://backend:80
```

다른 네임스페이스의 디버깅 Pod에서 확인한다면 다음처럼 네임스페이스를 명시합니다.

```bash
curl http://backend.default.svc.cluster.local:80
```

## 정리

Kubernetes 안에서 Pod는 IP로 직접 통신할 수 있습니다. 하지만 운영 환경의
애플리케이션은 Pod IP를 직접 기억하지 않습니다. Pod는 사라지고 다시 생길 수 있고,
replica 수도 계속 바뀔 수 있기 때문입니다.

그래서 서비스 간 통신은 Service 이름에서 시작합니다. `frontend` Pod가 `backend`
Service 이름으로 요청하면 다음 흐름이 이어집니다.

```text
Service 이름
  -> CoreDNS가 ClusterIP로 해석
  -> kube-proxy 또는 대체 dataplane이 준비한 노드 규칙으로 이동
  -> 그 규칙이 EndpointSlice 기반 endpoint 중 하나로 전달
  -> backend Pod가 요청 처리
```

Service 객체 자체가 요청을 처리하는 서버 프로세스는 아닙니다. Service는 이름,
ClusterIP, selector, port 규칙을 선언합니다. CoreDNS, EndpointSlice controller,
kube-proxy 또는 대체 dataplane이 선언한 규칙을 실제 네트워크 통신으로 바꿉니다.

여기까지 이해하면 `frontend` Pod가 `backend` Service 이름으로 요청했을 때,
그 요청이 실제 backend Pod까지 도달하는 경로를 끝까지 설명할 수 있습니다. 다만
아직 한 단계 더 아래의 질문이 남아 있습니다. Pod IP는 노드 위에서 어떻게 붙고,
다른 노드에 있는 Pod까지 가는 경로는 어떻게 만들어질까요? 그 부분은 CNI가 맡는
영역이므로, 2부에서는 CNI가 이 Pod 네트워크 모델을 어떻게 구현하는지 살펴보겠습니다.

## 참고 자료

- Kubernetes 공식 문서: [Pods](https://kubernetes.io/docs/concepts/workloads/pods/)
- Kubernetes 공식 문서: [Services, Load Balancing, and Networking](https://kubernetes.io/docs/concepts/services-networking/)
- Kubernetes 공식 문서: [Cluster Networking](https://kubernetes.io/docs/concepts/cluster-administration/networking/)
- Kubernetes 공식 문서: [Service](https://kubernetes.io/docs/concepts/services-networking/service/)
- Kubernetes 공식 문서: [Service ClusterIP allocation](https://kubernetes.io/docs/concepts/services-networking/cluster-ip-allocation/)
- Kubernetes 공식 문서: [DNS for Services and Pods](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/)
- Kubernetes 공식 문서: [Using CoreDNS for Service Discovery](https://kubernetes.io/docs/tasks/administer-cluster/coredns/)
- Kubernetes 공식 문서: [Customizing DNS Service](https://kubernetes.io/docs/tasks/administer-cluster/dns-custom-nameservers/)
- Kubernetes 공식 문서: [Virtual IPs and Service Proxies](https://kubernetes.io/docs/reference/networking/virtual-ips/)
- Kubernetes 공식 문서: [EndpointSlices](https://kubernetes.io/docs/concepts/services-networking/endpoint-slices/)
