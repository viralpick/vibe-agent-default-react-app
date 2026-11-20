import { useCallback, useEffect, useRef } from "react";
import { NavigationType, useLocation, useNavigate, useNavigationType } from "react-router-dom";
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
 *   READY        iframe → 호스트  { type, v, path }       라우터 준비. 처음 로드와 전체 새로고침 뒤 한 번
 *   ROUTE_CHANGE iframe → 호스트  { type, path, replace } 앱 안에서 페이지를 옮겼을 때. 이동 한 번에 한 번
 *   NAVIGATE     호스트 → iframe  { type, path }          replace 로 반영하고 ROUTE_CHANGE 를 돌려보내지 않는다
 *   BACK         iframe → 호스트  { type }                앱 안 뒤로 가기. 호스트가 history.back() 한다
 *
 * path 는 MemoryRouter 의 pathname + search 다 (`/` 로 시작).
 * replace 는 앱이 지금 칸을 바꿔 쓴 이동이다 (리다이렉트, 권한 가드, 저장 뒤 이동, 주소에 둔 필터).
 * 호스트가 이것까지 받아야 리다이렉트로 거쳐 간 주소가 브라우저 이력에 남지 않는다 — 남으면 뒤로 가기가
 * 그 주소로 돌아가 다시 리다이렉트되고, 사용자는 앱 밖으로 나가지 못한다. (APP-25)
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

/**
 * MemoryRouter 의 기록을 location.key 로 따라간다. 라우터는 지금 몇 번째 칸인지 알려주지 않아서,
 * POP 이동이 뒤로 간 것인지(앱 코드의 navigate(-1)) 앞으로 간 것인지 가리려면 직접 세어야 한다.
 */
type KeyTrail = { keys: string[]; index: number };

/** 이동 하나를 기록에 반영하고, 뒤로 간 POP 이었는지 돌려준다 */
const followTrail = (trail: KeyTrail, key: string, type: NavigationType): boolean => {
  if (type === NavigationType.Pop) {
    const at = trail.keys.lastIndexOf(key);
    if (at !== -1) {
      const movedBack = at < trail.index;
      trail.index = at;
      return movedBack;
    }
  }
  if (type === NavigationType.Replace) {
    trail.keys[trail.index] = key;
    return false;
  }
  // PUSH, 그리고 기록에 없는 key 의 POP 은 새 칸으로 센다
  trail.keys.splice(trail.index + 1, trail.keys.length, key);
  trail.index = trail.keys.length - 1;
  return false;
};

/** MemoryRouter 안에서 한 번 부른다 (main.tsx). 앱 코드는 부르지 않는다. */
export const useHostRoute = (): void => {
  const location = useLocation();
  const navigationType = useNavigationType();
  const navigate = useNavigate();
  const current = location.pathname + location.search;
  // 메시지 핸들러가 읽는 지금 경로
  const currentRef = useRef(current);
  // 알린 마지막 위치. 처음 위치는 READY 가 알리므로 그 key 로 시작한다
  const reportedKeyRef = useRef(location.key);
  // 호스트가 시킨 이동의 목적지. 그 이동은 ROUTE_CHANGE 로 돌려보내지 않는다
  const hostTargetRef = useRef<string | null>(null);
  const trailRef = useRef<KeyTrail>({ keys: [location.key], index: 0 });

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
    const movedBack = followTrail(trailRef.current, location.key, navigationType);
    const hostTarget = hostTargetRef.current;
    hostTargetRef.current = null;
    if (hostTarget === current) return;
    // 앱 코드가 navigate(-1) 로 뒤로 갔다. 이력의 주인은 호스트라 호스트에 뒤로 가기를 맡기고,
    // 호스트가 돌아간 주소를 NAVIGATE 로 받아 화면을 맞춘다. ROUTE_CHANGE 로 알리면 호스트는 그 이동을
    // 새 칸으로 쌓아, 뒤로 간다고 눌렀는데 브라우저 이력은 한 칸 늘어난다.
    // navigate(-2) 처럼 여러 칸을 건너도 한 칸만 돌아간다 — 호스트가 맞춘 주소로 화면이 다시 맞춰진다.
    if (movedBack) {
      postToHost({ type: PostMessageType.BACK });
      return;
    }
    postToHost({
      type: PostMessageType.ROUTE_CHANGE,
      path: current,
      replace: navigationType === NavigationType.Replace,
    });
  }, [location.key, current, navigationType]);

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
