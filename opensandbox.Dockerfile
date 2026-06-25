# OpenSandbox 용 App Builder 템플릿 이미지.
#
# e2b.Dockerfile(node:20 + view-gen clone)의 OpenSandbox 대응물. 단 베이스는 반드시
# opensandbox/code-interpreter 로 둔다 — OpenSandbox 는 sandbox 컨테이너 안에서
# code-interpreter 에이전트가 떠 있어야 server proxy 로 명령/파일 I/O 가 동작한다.
# (node:20 만으로 빌드하면 에이전트가 없어 health check/commands 가 안 될 수 있음)
#
# 빌드/푸시는 .github/workflows/sandbox-template-docker-hub.yaml(수동 트리거)이 수행한다.
#   docker build -f opensandbox.Dockerfile --build-arg CACHEBUST=$(date +%s) \
#     -t <registry>/agentos-view-gen:<tag> .
# 빌드 후 agent-app 의 OPENSANDBOX_IMAGE env 를 이 이미지로 지정한다.
FROM docker.io/opensandbox/code-interpreter:v1.1.0

# git 이 베이스에 없을 수 있어 보장 (이미 있으면 no-op).
USER root
RUN (command -v git >/dev/null 2>&1) || ( \
    apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/* \
    )

RUN mkdir -p /app/view-gen

# Cache-busting: 재빌드 시 --build-arg CACHEBUST=$(date +%s) 로 git clone 부터 강제 재실행.
# 값을 안 주면 기본값(1) 사용 → cache 사용.
ARG CACHEBUST=1

# HTTPS 로 clone (public repo). CACHEBUST 가 명령 텍스트에 포함돼 값이 바뀌면 layer invalidate.
RUN echo "Cachebust: ${CACHEBUST}" \
    && git clone https://github.com/viralpick/vibe-agent-default-react-app.git /app/view-gen

# npm install 은 view-gen 디렉토리에서 수행. 베이스 이미지의 WORKDIR(/workspace)은
# 바꾸지 않는다 — code-interpreter 에이전트가 그 WORKDIR 기준으로 동작.
RUN cd /app/view-gen && npm install

# sandbox 런타임 권한 보장 (uid 1000 비-root).
RUN chown -R 1000:1000 /app && chmod -R a+rwX /app

# 베이스 이미지의 ENTRYPOINT(code-interpreter 에이전트)를 그대로 상속한다 — 재정의하지 않음.
