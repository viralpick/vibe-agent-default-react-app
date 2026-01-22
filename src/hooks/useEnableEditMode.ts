import React from "react";
import { extractCodeFromViteRaw } from "../utils/extract-code-from-vite-raw";

type EditTextMetaData = {
  elementId: string | null;
  currentText: string;
  filePath: string | null;
  lineNumber: string | null;
  position: { x: number; y: number };
  /** The prop name being edited (e.g., "title", "description") */
  propName: string | null;
};


const isE2BSandbox = () => {
  if (typeof window === "undefined") return false;
  return window.location.hostname.endsWith(".e2b.app");
};

// Hover 스타일을 CSS로 주입 (Tailwind JIT 문제 해결)
const EDIT_MODE_STYLE_ID = "edit-mode-styles";
const injectEditModeStyles = () => {
  if (document.getElementById(EDIT_MODE_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = EDIT_MODE_STYLE_ID;
  style.textContent = `
    [data-editable="true"] {
      cursor: pointer;
    }
    [data-editable="true"]:hover {
      background-color: rgba(0, 178, 70, 0.2); 
    }
  `;
  document.head.appendChild(style);
};

export const useEnableEditMode = () => {
  const isE2B = isE2BSandbox();

  React.useEffect(() => {
    if (!isE2B) return;
    injectEditModeStyles();
  }, [isE2B]);

  // 편집 모드에서 클릭 처리
  React.useEffect(() => {
    if (!isE2B) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      if (target.hasAttribute("data-editable")) {
        e.stopPropagation();
        e.preventDefault();

        // Extract prop name from data-prop attribute
        const propName = target.getAttribute("data-prop");
        
        // Fallback: use data-prop as element-id if data-element-id is not set
        const elementId =
          target.getAttribute("data-element-id") || propName || null;
        
        // Default file path to src/App.tsx if not specified
        const filePath =
          target.getAttribute("data-file-path") || "src/App.tsx";

        const metadata: EditTextMetaData = {
          elementId,
          currentText: target.textContent ?? "",
          filePath,
          lineNumber: target.getAttribute("data-line-number"),
          position: { x: e.clientX, y: e.clientY },
          propName,
        };

        window.parent.postMessage(
          {
            type: "EDIT_REQUEST",
            payload: metadata,
          },
          "*"
        );
      }
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [isE2B]);

  // 쿼리 편집 모드에서 클릭 처리
  React.useEffect(() => {
    if (!isE2B) return;

    const handleChartClick = async (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // 차트/테이블 요소 찾기 (Card 또는 ChartContainer)
      const chartElement =
        target.closest('[data-slot="card"]') as HTMLElement ||
        target.closest('[data-chart]') as HTMLElement;

      if (!chartElement) {
        return;
      }

      // 편집 가능한 요소(data-editable)는 제외
      if (target.hasAttribute("data-editable") || target.closest('[data-editable]')) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      console.log('[useEnableEditMode] Chart/Table clicked, fetching source code...');

      try {
        // 클릭한 차트/테이블의 title 추출
        const cardTitle = chartElement.querySelector('[data-slot="card-title"]')?.textContent?.trim();
        console.log('[useEnableEditMode] Clicked chart title:', cardTitle);

        // src/App.tsx 파일 내용 가져오기
        const response = await fetch('/src/App.tsx?raw');
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.status}`);
        }

        const rawContent = await response.text();
        console.log('[useEnableEditMode] Raw content fetched, length:', rawContent.length);

        // Vite ?raw 응답에서 실제 코드 추출
        const sourceCode = extractCodeFromViteRaw(rawContent);
        console.log('[useEnableEditMode] Source code extracted, length:', sourceCode.length);

        // GraphQL 쿼리와 해당 쿼리를 사용하는 컴포넌트 매핑 분석
        // 1. 주석에서 query ID와 쿼리 추출
        // 패턴: // data-query-id="some-query-id"
        //       (다른 주석들...)
        //       const xxxQuery = `query Source { ... }`
        const queries: Array<{ varName: string; queryId: string; content: string }> = [];

        // 전역 regex로 모든 주석 위치 찾기
        const commentRegex = /\/\/\s*data-query-id=["']([^"']+)["']/g;
        let commentMatch;

        while ((commentMatch = commentRegex.exec(sourceCode)) !== null) {
          const queryId = commentMatch[1];
          const commentIndex = commentMatch.index;

          console.log('[useEnableEditMode] Found comment:', queryId, 'at index', commentIndex);

          // 주석 다음 위치부터 쿼리 찾기 (최대 500자 이내)
          const searchStart = commentIndex + commentMatch[0].length;
          const searchEnd = Math.min(searchStart + 500, sourceCode.length);
          const searchArea = sourceCode.substring(searchStart, searchEnd);

          // 쿼리 변수 찾기 - 변수명이 Query 또는 query로 끝나거나 포함하는 경우
          const queryMatch = searchArea.match(/const\s+(\w*[Qq]uery\w*)\s*=\s*`(query[\s\S]*?)`/);

          if (queryMatch) {
            const varName = queryMatch[1];
            const queryContent = queryMatch[2];

            queries.push({ varName, queryId, content: queryContent });
            console.log('[useEnableEditMode] Found query:', { varName, queryId, contentLength: queryContent.length });
          } else {
            console.warn('[useEnableEditMode] Query not found after comment:', queryId);
          }
        }

        console.log('[useEnableEditMode] Found queries:', queries.map(q => ({ varName: q.varName, queryId: q.queryId })));

        if (queries.length === 0) {
          console.warn('[useEnableEditMode] No queries found in source code');
          return;
        }

        // 2. 컴포넌트의 data-query-id prop으로 매칭
        // 패턴: <StatCard data-query-id="sentiment-analysis-query" title={...긍정 리뷰 비율...}>
        let matchedQuery = null;

        // 전역 regex로 모든 컴포넌트에서 data-query-id prop 찾기
        const componentRegex = /<(StatCard|Dynamic(?:Bar|Line|Area|Composed|Pie)Chart|DynamicDataTable)[^>]*data-query-id=["']([^"']+)["'][^>]*>/g;
        let componentMatch;

        while ((componentMatch = componentRegex.exec(sourceCode)) !== null) {
          const componentType = componentMatch[1];
          const componentQueryId = componentMatch[2];
          const componentIndex = componentMatch.index;

          console.log('[useEnableEditMode] Found component:', componentType, 'with query ID:', componentQueryId);

          // 해당 query ID와 일치하는 쿼리 찾기
          const query = queries.find(q => q.queryId === componentQueryId);
          if (!query) {
            console.warn('[useEnableEditMode] Query not found for component query ID:', componentQueryId);
            continue;
          }

          // 컴포넌트 다음 500자 이내에서 title 찾기
          const searchArea = sourceCode.substring(componentIndex, componentIndex + 500);

          // title prop의 EditableText에서 텍스트 추출
          const titleMatch = searchArea.match(/title=\{[^}]*<EditableText[^>]*>\s*([^<]+)\s*<\/EditableText>/);

          if (titleMatch) {
            const componentTitle = titleMatch[1].trim();
            console.log('[useEnableEditMode] Component title:', componentTitle, 'for query:', componentQueryId);

            // title이 클릭한 카드의 title과 일치하는지 확인
            if (cardTitle && componentTitle.toLowerCase().includes(cardTitle.toLowerCase())) {
              matchedQuery = query;
              console.log('[useEnableEditMode] ✅ Matched query:', query.queryId, 'with clicked title:', cardTitle);
              break;
            }
          }
        }

        // 매칭된 쿼리가 없으면 첫 번째 쿼리 사용
        const selectedQuery = matchedQuery || queries[0];

        if (!matchedQuery) {
          console.warn('[useEnableEditMode] ❌ No matching query found for title:', cardTitle, '- using first query');
        }

        console.log('[useEnableEditMode] QUERY_CLICK detected:', {
          queryId: selectedQuery.queryId,
          queryContent: selectedQuery.content.substring(0, 50) + '...',
          filePath: 'src/App.tsx',
          position: { x: e.clientX, y: e.clientY },
        });

        window.parent.postMessage(
          {
            type: 'QUERY_CLICK',
            payload: {
              queryId: selectedQuery.queryId,
              queryContent: selectedQuery.content,
              filePath: 'src/App.tsx',
              position: { x: e.clientX, y: e.clientY },
            },
          },
          '*'
        );

        console.log('[useEnableEditMode] QUERY_CLICK message sent to parent');
      } catch (error) {
        console.error('[useEnableEditMode] Error fetching or parsing source code:', error);
      }
    };

    document.addEventListener('click', handleChartClick, true);
    return () => document.removeEventListener('click', handleChartClick, true);
  }, [isE2B]);

  // 파일 업데이트 응답 리스너
  React.useEffect(() => {
    if (!isE2B) return;

    const handleEditResponse = (e: MessageEvent) => {
      if (e.data.type === "FILE_UPDATED") {
        // HMR replacement automatically
      }
    };

    window.addEventListener("message", handleEditResponse);
    return () => window.removeEventListener("message", handleEditResponse);
  }, [isE2B]);
};
