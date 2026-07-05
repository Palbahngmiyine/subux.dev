---
title: "Kubernetes Pod 네트워킹 이해하기 2부: CNI와 NetworkPolicy"
description: "1부에서 남긴 Pod IP와 노드 간 경로 질문을 CNI와 NetworkPolicy 관점에서 정리합니다."
date: 2026-07-05
series: "Kubernetes Pod 네트워킹 이해하기"
seriesOrder: 2
---

1부에서는 Pod 안의 컨테이너가 `localhost`로 통신하는 이유, 다른 Pod가 각자
Pod IP를 갖는 이유, 그리고 실제 애플리케이션 코드가 Pod IP 대신 Service 이름을
사용하는 이유를 살펴봤습니다. 흐름을 압축하면 다음과 같습니다.

```text
frontend 서버/BFF/API 프록시 Pod
  -> http://backend:80
  -> CoreDNS가 backend Service의 ClusterIP로 해석
  -> kube-proxy 또는 대체 dataplane이 EndpointSlice의 backend Pod 중 하나로 전달
```

여기까지 이해하면 Service 이름에서 실제 backend Pod까지 가는 경로는 설명할 수
있습니다. 하지만 1부 마지막에 남긴 질문이 아직 있습니다.

```text
Pod IP는 노드 위에서 어떻게 붙을까?
다른 노드에 있는 Pod IP까지 가는 경로는 누가 만들까?
NetworkPolicy는 이 경로 어디에서 통신을 막을까?
```

2부에서는 이 질문을 기준으로 한 단계 아래 계층을 봅니다. Kubernetes 공식 문서는
클러스터 네트워킹을 컨테이너 간 통신, Pod 간 통신, Pod와 Service 간 통신,
외부와 Service 간 통신으로 나눕니다. 1부가 Service 이름, DNS, ClusterIP,
EndpointSlice, kube-proxy를 중심으로 Pod와 Service 사이를 봤다면, 2부는 Pod IP와
노드 간 경로를 실제로 구성하는 CNI 계층을 확인해 보겠습니다.

이번 글의 목표는 두 가지입니다.

- Kubernetes 네트워크 모델과 CNI의 책임 범위를 구분합니다.
- NetworkPolicy가 어떤 조건에서 실제로 트래픽을 제한하는지 이해합니다.

## 먼저 네트워크 계층을 나누어 보기

Kubernetes 네트워킹을 볼 때 가장 중요한 기준은 "어떤 객체가 선언이고, 어떤
컴포넌트가 실제 패킷 경로를 만드는가"입니다. Service는 안정적인 이름과 가상 IP를
선언합니다. EndpointSlice는 Service 뒤의 실제 endpoint 목록을 담습니다.
kube-proxy나 대체 dataplane은 ClusterIP로 온 패킷을 endpoint로 보내는 규칙을
만듭니다.

하지만 이것만으로는 Pod IP 자체가 만들어지지 않습니다. Pod IP를 할당하고, 같은
노드 또는 다른 노드의 Pod IP까지 도달할 수 있는 네트워크 경로를 구성하는 일은
네트워크 플러그인, 즉 CNI가 맡습니다.

공식 문서의 IP 대역 관점으로 보면 역할이 더 분명합니다.

- Pod IP 대역은 네트워크 플러그인이 Pod에 IP를 할당할 때 사용합니다.
- Service IP 대역은 API 서버가 ClusterIP Service에 IP를 할당할 때 사용합니다.
- Node IP는 kubelet이나 cloud-controller-manager가 노드 주소로 관리합니다.

그래서 `10.244.1.20` 같은 Pod IP와 `10.96.30.100` 같은 Service ClusterIP는 같은
"클러스터 내부 IP"처럼 보이더라도 성격이 다릅니다. Pod IP는 실제 Pod 네트워크의
endpoint 주소이고, ClusterIP는 Service를 대표하는 가상 IP입니다.

이 차이를 잡아 두면 CNI와 kube-proxy의 경계도 명확해집니다.

```text
Pod IP와 노드 간 Pod 경로
  -> CNI가 담당

Service ClusterIP를 현재 endpoint Pod로 보내는 규칙
  -> kube-proxy 또는 대체 dataplane이 담당

Service 이름을 ClusterIP로 해석
  -> CoreDNS가 담당
```

## CNI는 어디에 끼어들까?

CNI는 Container Network Interface의 약자입니다. Kubernetes는 클러스터 네트워킹에
CNI 플러그인을 사용할 수 있고, Kubernetes 네트워크 모델을 구현하려면 호환되는
CNI 플러그인이 필요하다고 설명합니다.

여기서 중요한 점은 Kubernetes가 "Pod끼리 통신 가능해야 한다"는 모델을 정하고,
그 모델을 실제 노드의 네트워크 구성으로 바꾸는 세부 구현은 CNI 플러그인마다
달라진다는 것입니다. kind의 기본 네트워크 구현인 `kindnetd`, Calico, Cilium,
Flannel, Antrea 같은 구현은 모두 이 경계 안에서 각자의 방식으로 Pod 네트워크를
만듭니다.

Pod가 생성될 때 흐름을 단순화하면 다음과 같습니다.

세부 호출 방식과 내부 구현은 container runtime과 CNI 플러그인마다 다를 수 있습니다.
여기서 container runtime은 containerd나 CRI-O 같은 노드의 컨테이너 런타임을
뜻합니다.

```text
1. 사용자가 Pod 또는 Deployment를 만든다.
2. 스케줄러가 Pod를 특정 노드에 배치한다.
3. kubelet이 CRI로 container runtime에 sandbox 생성을 요청한다.
4. container runtime이 먼저 빈 Pod sandbox와 network namespace를 만든다.
5. 이 namespace가 CNI 작업 대상이 되고, container runtime이 CNI를 호출한다.
6. CNI 플러그인이 그 namespace에 Pod용 인터페이스를 붙인다.
7. CNI/IPAM이 Pod IP와 route, bridge, overlay/eBPF를 구성한다.
8. 준비 후 container runtime이 kubelet에 Pod IP를 보고한다.
9. kubelet은 app container들을 그 Pod sandbox 안에서 시작하게 한다.
10. app container들은 같은 network namespace와 Pod IP를 공유한다.
11-1. Pod 밖으로 나가는 패킷은 CNI가 만든 인터페이스와 route를 사용한다.
11-2. 같은 Pod 안의 컨테이너들은 localhost로 서로 통신할 수 있다.
12. Pod 삭제 시 container runtime과 CNI가 네트워크 구성을 정리한다.
```

여기서 Pod sandbox는 애플리케이션 컨테이너가 이미 실행된 상태를 뜻하지 않습니다.
먼저 네트워크를 구성할 대상이 될 빈 Pod용 실행 공간을 준비하는 단계입니다.

네트워킹 관점에서는 특히 network namespace가 중요합니다. container runtime이
sandbox와 network namespace를 먼저 만들고 나면, CNI는 그 namespace에 인터페이스를
붙이고 IP와 route를 구성합니다.

그 다음 app container들이 같은 sandbox 안에서 시작됩니다. 그래서 같은 Pod 안의
컨테이너들은 같은 network namespace와 Pod IP를 공유하고, `localhost`로 서로 통신할
수 있습니다.

Pod 밖으로 나가는 패킷은 CNI가 구성한 인터페이스와 route를 따라 노드 또는 다른
Pod로 이동합니다.

Pod가 삭제될 때는 이 정상 실행 경로가 끝난 뒤 container runtime과 CNI가 컨테이너,
sandbox, 네트워크 구성을 정리합니다.

이 흐름에서 kubelet은 Pod를 노드에서 실행되게 조율합니다. kubelet은 CRI를 통해
container runtime에 요청하고, container runtime은 노드에 설치된 CNI 플러그인을
로드해 Pod 네트워크를 준비합니다.

Pod 간 통신에 필요한 인터페이스, IP, 라우팅, overlay, eBPF 경로 같은 구체적인
네트워크 구현은 CNI 플러그인과 container runtime 쪽 설정에 의해 결정됩니다.

Kubernetes 1.24부터는 예전 kubelet command-line parameter 방식으로 CNI를 관리하던
흐름도 제거되었습니다. 그래서 최신 클러스터를 볼 때는 container runtime이 CNI
플러그인을 로드하도록 구성되어 있다는 점을 기준으로 이해해주시면 좋을 것 같습니다.

## Service 경로와 Pod 네트워크 경로는 이어져 있다

1부에서 본 Service 요청 흐름은 사실 중간부터 CNI가 만든 Pod 네트워크 경로를
사용합니다.

```text
client Pod
  -> DNS로 backend Service의 ClusterIP 확인
  -> ClusterIP:80으로 패킷 전송
  -> kube-proxy 또는 대체 dataplane이 endpoint PodIP:targetPort 선택
  -> CNI가 만든 Pod 네트워크 경로를 따라 backend Pod IP까지 이동
```

반대로 Pod IP를 직접 호출하면 DNS와 Service 계층을 건너뜁니다.

```text
client Pod
  -> backend PodIP:80으로 직접 패킷 전송
  -> CNI가 만든 Pod 네트워크 경로를 따라 backend Pod까지 이동
```

운영 애플리케이션에서는 Pod IP를 직접 쓰지 않습니다. 하지만 디버깅할 때는
Pod IP 직접 호출과 Service 호출을 비교하면 장애 지점을 좁히기 좋습니다.

- Pod IP 직접 호출은 되는데 Service 호출이 안 되면 Service selector,
  EndpointSlice, kube-proxy/dataplane, DNS를 봅니다.
- Pod IP 직접 호출도 안 되면 CNI, 노드 route, overlay, NetworkPolicy,
  애플리케이션 listen 주소를 봅니다.

즉 Service 문제처럼 보이는 장애도 마지막에는 CNI가 만든 Pod 네트워크 경로를
지납니다. 그래서 DNS, Service, EndpointSlice가 모두 맞는데도 연결이 안 되면
CNI 계층을 확인해야 합니다.

## CNI 구현은 왜 서로 다를까?

Kubernetes 네트워크 모델은 "Pod가 어떤 방식으로든 통신 가능해야 한다"는 요구사항에
가깝습니다. 구현 방식은 하나로 고정되어 있지 않습니다.

예를 들어 CNI 구현은 다음 중 하나 또는 여러 방식을 사용할 수 있습니다.

- 노드에 bridge와 veth pair를 구성합니다.
- 노드 간 route를 구성해 Pod CIDR로 직접 라우팅합니다.
- VXLAN 같은 overlay 네트워크로 노드 사이 Pod 트래픽을 캡슐화합니다.
- eBPF를 사용해 Service 처리, NetworkPolicy, routing을 커널 dataplane에서 처리합니다.
- cloud provider의 VPC 라우팅이나 ENI 같은 기능과 통합합니다.

이 차이 때문에 같은 Kubernetes 객체를 쓰더라도 관찰해야 하는 위치가 달라집니다.
kind 기본 클러스터에서는 `kindnetd`와 kube-proxy를 보게 됩니다. Cilium을
kube-proxy replacement 모드로 쓰는 클러스터에서는 kube-proxy가 없거나 역할이 줄고,
Cilium agent와 eBPF map을 확인해야 할 수 있습니다. Calico를 쓰는 클러스터에서는
Calico node agent, route, iptables/eBPF 모드를 함께 봐야 할 수 있습니다.

그래서 Pod 네트워킹을 깊게 볼 때는 특정 CNI 이름에서 출발하기보다, 패킷이 어떤
계층의 상태를 참조하며 이동하는지부터 고정하는 편이 좋습니다.

같은 `frontend -> backend` 요청이라도 실제 경로는 DNS 응답, Service dataplane,
Pod network namespace, 노드 route, NetworkPolicy enforcement를 차례로 지납니다.
구현체가 달라져도 이 질문들은 유지됩니다.

- 이 Pod는 어떤 network namespace와 Pod IP를 받았는가?
- Service 이름은 어떤 DNS 응답으로 해석되는가?
- ClusterIP로 간 패킷은 어느 dataplane에서 endpoint로 바뀌는가?
- 선택된 endpoint Pod IP까지 가는 노드 간 경로는 어떻게 만들어졌는가?
- NetworkPolicy가 있다면 어느 지점에서 ingress/egress를 제한하는가?

이 기준으로 보면 각 컴포넌트는 다음 계층을 담당합니다.

```text
Pod network layer
  Pod IP, Pod network namespace, 노드 간 Pod 경로, NetworkPolicy enforcement
  예: kindnetd, Calico, Cilium, Flannel, Antrea, cloud provider CNI

Service discovery layer
  Service 이름을 ClusterIP 또는 headless endpoint로 해석
  예: CoreDNS, NodeLocal DNSCache, kube-dns(legacy)

Service dataplane layer
  Service ClusterIP 트래픽을 EndpointSlice 기반 backend로 전달
  예: kube-proxy(iptables/nftables/IPVS/kernelspace), Cilium kube-proxy replacement
```

여기까지는 주로 "패킷이 어디로 갈 수 있게 만드는가"에 대한 이야기였습니다.
CNI는 Pod에 IP를 주고, Pod network namespace를 노드의 네트워크에 연결하고,
다른 Pod IP까지 도달할 수 있는 경로를 만듭니다.

그 다음 질문은 "그 경로를 항상 모두 허용할 것인가"입니다. Kubernetes 네트워크
모델은 기본적으로 Pod 간 통신 가능성을 전제로 하지만, 실제 운영 환경에서는
모든 Pod가 모든 Pod와 자유롭게 통신하면 안 되는 경우가 많습니다.

이때 등장하는 객체가 NetworkPolicy입니다. NetworkPolicy는 새로운 네트워크 경로를
만드는 객체라기보다, 이미 만들어진 Pod 네트워크 경로 위에서 어떤 ingress와 egress를
허용할지 선언하는 정책입니다. 그리고 이 정책을 실제 패킷 처리 지점에서 강제하는
역할은 NetworkPolicy를 지원하는 CNI 또는 네트워크 정책 구현체가 맡습니다.

## NetworkPolicy는 무엇을 제한할까?

NetworkPolicy는 Pod를 기준으로 ingress와 egress 트래픽을 제한하는 Kubernetes
리소스입니다. 공식 문서 기준으로 NetworkPolicy는 L3/L4, 즉 IP 주소, 포트,
프로토콜 수준의 흐름을 다룹니다. HTTP path, JWT, TLS 세부 조건 같은 L7 정책은
기본 NetworkPolicy의 책임 범위가 아닙니다.

NetworkPolicy를 이해할 때는 네 가지 규칙이 중요합니다.

첫째, NetworkPolicy는 네트워크 플러그인이 구현합니다. 클러스터의 CNI가
NetworkPolicy enforcement를 지원하지 않으면, NetworkPolicy 객체를 만들어도
실제 차단 효과가 없습니다.

둘째, 기본 상태의 Pod는 ingress와 egress 양쪽에서 non-isolated입니다. 즉 별도의
정책이 없으면 일반적으로 들어오는 연결과 나가는 연결이 모두 허용됩니다.

셋째, 어떤 Pod가 특정 방향의 NetworkPolicy에 의해 선택되면 그 방향은 isolated
상태가 됩니다. 그러면 해당 방향에서 허용 규칙에 맞는 연결만 허용됩니다.

넷째, 정책은 순서대로 평가되어 서로 덮어쓰는 방식이 아니라 허용 조건이 누적되는
방식으로 적용됩니다. 같은 Pod에 여러 정책이 적용되면 허용되는 연결의 합집합이
최종 허용 목록이 됩니다.
한 Pod에서 다른 Pod로 가는 연결은 출발 Pod의 egress 정책과 도착 Pod의 ingress
정책을 모두 통과해야 합니다.

예를 들어 아래 정책은 `app=backend` Pod를 ingress 방향에서 isolated 상태로 만들고,
허용 규칙을 하나도 주지 않습니다.

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-deny-ingress
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
    - Ingress
```

그리고 아래 정책은 `app=client` label을 가진 Pod에서 `app=backend` Pod의
80번 TCP 포트로 들어오는 연결만 허용합니다.

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-allow-client
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: client
      ports:
        - protocol: TCP
          port: 80
```

결과적으로 두 정책은 모두 `app=backend` Pod의 ingress 방향에 적용됩니다.
첫 번째 정책은 `backend` Pod로 들어오는 연결을 일단 제한 대상으로 만들고,
두 번째 정책은 그중 `app=client` Pod가 TCP 80번 포트로 보내는 연결만 허용 목록에
추가합니다.

따라서 다른 Pod에서 오는 연결이나 80번이 아닌 포트로 들어오는 연결은 차단됩니다.
다만 출발 Pod에도 egress 정책이 적용되어 있다면, 그 egress 정책 역시 같은 연결을
허용해야 실제 통신이 성립합니다.

주의할 점도 있습니다.

- `podSelector`는 기본적으로 같은 네임스페이스의 Pod를 고릅니다. 다른 네임스페이스의
  Pod를 허용하려면 `namespaceSelector`를 함께 고려해야 합니다.
- `ipBlock`은 CIDR 기준으로 허용 대상을 표현하지만, Service나 LoadBalancer를 지나는
  트래픽은 주소 변환 때문에 실제 정책 적용 지점에서 보이는 IP가 달라질 수 있습니다.
- NetworkPolicy는 Service 이름을 직접 대상으로 삼는 정책이 아닙니다. 보통 Pod label,
  namespace label, IP block을 기준으로 표현합니다.
- 이미 열린 연결에 정책 변경이 어떤 방식으로 반영되는지는 구현에 따라 달라질 수
  있습니다.

kind의 기본 `kindnetd`는 단순한 네트워크 구현입니다. Pod 간 통신과 기본적인 Service
흐름을 관찰하기에는 충분하지만, NetworkPolicy 차단 효과까지 확인하려면 Calico나
Cilium처럼 NetworkPolicy를 지원하는 CNI를 설치한 클러스터를 사용하는 편이 좋습니다.

## 정리

CNI는 Pod가 사용할 network namespace에 인터페이스, Pod IP, route를 구성하고,
Service dataplane은 그 위에서 ClusterIP 트래픽을 실제 endpoint Pod로 보냅니다.
두 계층은 분리되어 있지만, Service 요청도 마지막에는 CNI가 만든 Pod 네트워크 경로를
사용합니다.

NetworkPolicy는 이 경로 위에서 어떤 ingress와 egress를 허용할지 선언합니다.
정책 객체 자체가 새로운 경로를 만드는 것은 아니며, 실제 차단 효과는 사용 중인 CNI나
네트워크 정책 구현체가 enforcement를 지원할 때 나타납니다.

그래서 Kubernetes 네트워크 문제를 볼 때는 다음 순서로 내려가면 됩니다.

```text
애플리케이션 listen 주소와 Pod readiness
  -> Service selector와 EndpointSlice
  -> DNS와 ClusterIP
  -> kube-proxy 또는 대체 dataplane
  -> CNI가 만든 Pod 네트워크 경로
  -> NetworkPolicy
```

이 순서로 보면 `frontend` Pod가 `backend` Service 이름으로 요청했을 때의 상위
흐름과, 그 요청이 실제 Pod IP까지 이동하는 하위 흐름을 함께 설명할 수 있습니다.

## 참고 자료

- Kubernetes 공식 문서: [Cluster Networking](https://kubernetes.io/docs/concepts/cluster-administration/networking/)
- Kubernetes 공식 문서: [Network Plugins](https://kubernetes.io/docs/concepts/extend-kubernetes/compute-storage-net/network-plugins/)
- Kubernetes 공식 문서: [Service](https://kubernetes.io/docs/concepts/services-networking/service/)
- Kubernetes 공식 문서: [DNS for Services and Pods](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/)
- Kubernetes 공식 문서: [EndpointSlices](https://kubernetes.io/docs/concepts/services-networking/endpoint-slices/)
- Kubernetes 공식 문서: [Virtual IPs and Service Proxies](https://kubernetes.io/docs/reference/networking/virtual-ips/)
- Kubernetes 공식 문서: [Network Policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
