import { useEffect, useState } from "react";

/**
 * URL query parameter에서 token을 추출하고 관리하는 hook
 *
 * @example
 * // URL: https://example.com?token=abc123
 * const { token, hasToken } = useUrlToken();
 * // token === "abc123"
 * // hasToken === true
 */
export function useUrlToken() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // URL query parameter에서 token 추출
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");

    if (urlToken) {
      console.log("[useUrlToken] Token extracted from URL");
      setToken(urlToken);

      // 보안을 위해 URL에서 token 제거 (선택적)
      // params.delete("token");
      // const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
      // window.history.replaceState({}, "", newUrl);
    } else {
      console.log("[useUrlToken] No token found in URL");
    }
  }, []);

  return {
    token,
    hasToken: !!token,
  };
}
