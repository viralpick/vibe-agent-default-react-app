import { useEffect } from "react";
import { PostMessageType } from "../types/auth.types";
import { validateOrigin } from "../utils/security.utils";

/**
 * 파일 내용 요청을 처리하는 PostMessage 훅
 * 부모 윈도우(호스트)에서 파일 내용을 요청하면 Vite dev server에서 가져와서 응답합니다.
 */
export function usePostMessageFileContent() {
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      console.log("[DEBUG] Message received, type:", event.data?.type);

      // 1. Origin 검증
      if (!validateOrigin(event.origin)) {
        console.warn(
          "[usePostMessageFileContent] Invalid origin:",
          event.origin
        );
        return;
      }

      console.log("[DEBUG] Origin validated, checking data...");

      // 2. 메시지 데이터 타입 확인
      const data = event.data;
      if (!data || typeof data !== "object") {
        return;
      }

      console.log(
        "[DEBUG] Comparing:",
        data.type,
        "===",
        PostMessageType.REQUEST_FILE_CONTENT
      );

      // 3. REQUEST_FILE_CONTENT 메시지 처리
      if (data.type === PostMessageType.REQUEST_FILE_CONTENT) {
        console.log(
          "[DEBUG] Match! Processing file request for:",
          data.filePath
        );
        const { filePath, nonce } = data;

        if (!filePath || typeof filePath !== "string") {
          console.error(
            "[usePostMessageFileContent] Invalid filePath:",
            filePath
          );
          return;
        }

        try {
          // Vite dev server에서 파일 내용 가져오기
          // ?raw 쿼리를 사용하면 Vite가 파일을 원본 텍스트로 반환
          const normalizedPath = filePath.startsWith("/")
            ? filePath
            : `/${filePath}`;
          const response = await fetch(`${normalizedPath}?raw`);

          if (!response.ok) {
            throw new Error(
              `Failed to fetch file: ${response.status} ${response.statusText}`
            );
          }

          const content = await response.text();

          // 부모에게 파일 내용 전송
          if (window.parent && window.parent !== window) {
            window.parent.postMessage(
              {
                type: PostMessageType.FILE_CONTENT,
                filePath,
                content,
                timestamp: Date.now(),
                nonce,
              },
              event.origin
            );
          }
        } catch (error) {
          console.error(
            "[usePostMessageFileContent] Error fetching file:",
            error
          );

          // 에러 응답 전송
          if (window.parent && window.parent !== window) {
            window.parent.postMessage(
              {
                type: PostMessageType.FILE_CONTENT_ERROR,
                filePath,
                error: error instanceof Error ? error.message : "Unknown error",
                timestamp: Date.now(),
                nonce,
              },
              event.origin
            );
          }
        }
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);
}
