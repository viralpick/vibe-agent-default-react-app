FROM node:20-bullseye

RUN apt-get update \
    && apt-get install -y git \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /app/view-gen

# Cache-busting: e2b CLI v1 의 --no-cache 가 docker build 에 전달되지 않는 문제 우회.
# 빌드 시 --build-arg CACHEBUST=$(date +%s) 로 매번 다른 값 주입 → git clone 부터 강제 새로 실행.
# 값을 안 주면 기본값(1) 사용 → cache 사용 (재빌드 의도가 없을 때).
ARG CACHEBUST=1

# HTTPS로 clone (CACHEBUST 가 명령 텍스트의 일부라 값 바뀌면 layer invalidate)
RUN echo "Cachebust: ${CACHEBUST}" \
    && git clone https://github.com/viralpick/vibe-agent-default-react-app.git /app/view-gen

WORKDIR /app/view-gen

RUN npm install

# 권한 필요하면 마지막에 한 번만
RUN chown -R 1000:1000 /app && chmod -R a+rwX /app
