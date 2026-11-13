import { useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { validateNavigatePayload } from "../schemas/auth.schemas";
import {
  PostMessageType,
  type BackPayload,
  type RouteChangePayload,
  type RouteReadyPayload,
} from "../types/auth.types";

/**
 * 앱 안 다중 페이지 — 호스트(앱빌더 FE)와 경로를 맞추는 템플릿 훅. (AOS-8191)
 *
 * 앱은 iframe 안에서 MemoryRouter 로 페이지를 옮긴다. iframe 주소는 환경마다 달라서
 * (생성 화면은 sandbox 프록시, 실행 화면은 /api/dashboards/{id}/view/index.html) 라우터가 그 주소를
 * 읽지 않는다. 브라우저 이력과 주소창은 호스트만 쓰고, 앱은 옮긴 사실만 알린다.
 *
 * 메시지 (iframe ↔ 호스트). type 은 PostMessageType 과 같은 문자열이다.
 *   READY        iframe → 호스트  { type, v, path }  라우터 준비. 처음 로드와 전체 새로고침 뒤 한 번
 *   ROUTE_CHANGE iframe → 호스트  { type, path }     앱 안에서 페이지를 옮겼을 때. 이동 한 번에 한 번
 *   NAVIGATE     호스트 → iframe  { type, path }     replace 로 반영하고 ROUTE_CHANGE 를 돌려보내지 않는다
 *   BACK         iframe → 호스트  { type }           앱 안 뒤로 버튼. 호스트가 history.back() 한다
 *
 * path 는 MemoryRouter 의 pathname + search 다 (`/` 로 시작).
 * 규약 버전(v)은 READY 에만 싣는다. 배포된 번들은 배포 시점 템플릿으로 고정되므로 호스트가 옛 규약의
 * 앱을 구분할 수 있어야 한다.
 */
export const HOST_ROUTE_PROTOCOL_VERSION = 1;

/** iframe 주소에서 시작 경로를 읽는 쿼리 이름. 호스트가 첫 화면부터 그 페이지를 그리게 할 때 쓴다 */
export const INITIAL_PATH_PARAM = "path";

const isEmbedded = (): boolean => {
  try {
    return window.parent !== window;
  } catch {
    return true;
  }
};

type HostRouteMessage = RouteReadyPayload | RouteChangePayload | BackPayload;

const postToHost = (message: HostRouteMessage): void => {
  if (!isEmbedded()) return;
  // 경로 문자열만 싣는다. 호스트 origin 은 환경마다 달라(콘솔 · same-origin 프록시 · 온프렘) 다른 템플릿
  // 메시지처럼 "*" 로 보내고, 호스트가 event.source 로 이 iframe 인지 확인한다.
  window.parent.postMessage(message, "*");
};

/** 처음 로드에 READY 를 이미 보냈는가. StrictMode 의 effect 두 번 실행에도 한 번만 보내려고 모듈에 둔다 */
let isReadySent = false;

/** iframe 주소의 `?path=` 를 시작 경로로 쓴다. 없거나 앱 안 경로가 아니면 `/`. */
export const initialPathFromUrl = (): string => {
  try {
    const path = new URLSearchParams(window.location.search).get(INITIAL_PATH_PARAM);
    if (path !== null && validateNavigatePayload({ type: PostMessageType.NAVIGATE, path }).success) {
      return path;
    }
  } catch {
    // 주소를 못 읽으면 첫 페이지
  }
  return "/";
};

/** MemoryRouter 안에서 한 번 부른다 (main.tsx). 앱 코드는 부르지 않는다. */
export const useHostRoute = (): void => {
  const location = useLocation();
  const navigate = useNavigate();
  const current = location.pathname + location.search;
  // 메시지 핸들러가 읽는 지금 경로
  const currentRef = useRef(current);
  // 알린 마지막 위치. 처음 위치는 READY 가 알리므로 그 key 로 시작한다
  const reportedKeyRef = useRef(location.key);
  // 호스트가 시킨 이동의 목적지. 그 이동은 ROUTE_CHANGE 로 돌려보내지 않는다
  const hostTargetRef = useRef<string | null>(null);

  useEffect(() => {
    if (isReadySent) return;
    isReadySent = true;
    postToHost({ type: PostMessageType.READY, v: HOST_ROUTE_PROTOCOL_VERSION, path: currentRef.current });
  }, []);

  // location.key 는 이동마다 새로 생긴다 — 같은 경로로 다시 이동해도 사용자 이동이면 알린다.
  // key 로 거르므로 StrictMode 의 두 번 실행이나 다른 이유의 리렌더에도 한 번만 나간다.
  useEffect(() => {
    currentRef.current = current;
    if (location.key === reportedKeyRef.current) return;
    reportedKeyRef.current = location.key;
    const hostTarget = hostTargetRef.current;
    hostTargetRef.current = null;
    if (hostTarget === current) return;
    postToHost({ type: PostMessageType.ROUTE_CHANGE, path: current });
  }, [location.key, current]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      // 부모 창이 보낸 것만 받는다. 단독 실행(parent === window)이면 자기 자신이 보낸 메시지라 받지 않는다
      if (event.source !== window.parent || event.source === window) return;
      const result = validateNavigatePayload(event.data);
      if (!result.success) return;
      const { path } = result.data;
      if (path === currentRef.current) return;
      hostTargetRef.current = path;
      navigate(path, { replace: true });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [navigate]);
};

/**
 * 앱 안 "뒤로" 버튼이 부르는 함수를 돌려준다.
 *
 * iframe 안에서는 호스트에 BACK 을 보내 호스트가 브라우저 이력으로 돌아가게 한다. 라우터의 navigate(-1) 은
 * 쓰지 않는다 — 이력의 주인은 호스트라, 앱이 따로 돌아가면 주소창과 화면이 어긋난다.
 * 호스트 없이 단독으로 띄웠을 때만 라우터 이력으로 돌아간다 (호스트가 없으니 어긋날 주소창도 없다).
 *
 * @example
 * import { useHostBack } from "@/hooks/useHostRoute";
 * const goBack = useHostBack();
 * <button onClick={goBack}>뒤로</button>
 */
export const useHostBack = (): (() => void) => {
  const navigate = useNavigate();
  return useCallback(() => {
    if (isEmbedded()) postToHost({ type: PostMessageType.BACK });
    else navigate(-1);
  }, [navigate]);
};
