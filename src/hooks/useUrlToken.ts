import { setStaticToken } from "@/api/api.client";
import { useEffect } from "react";

/**
 * URL query parameter에서 token을 추출하고 관리하는 hook
 *
 */
export function useUrlToken() {
  useEffect(() => {
    // URL query parameter에서 token 추출
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");

    if (urlToken) {
      console.log("[useUrlToken] Token extracted from URL");
      setStaticToken(urlToken);
    } else {
      console.log("[useUrlToken] No token found in URL");
    }
  }, []);
}
