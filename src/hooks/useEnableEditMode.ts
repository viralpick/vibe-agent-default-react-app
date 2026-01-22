import React from "react";

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

        const sourceCode = await response.text();
        console.log('[useEnableEditMode] Source code fetched, length:', sourceCode.length);

        // GraphQL 쿼리와 해당 쿼리를 사용하는 컴포넌트 매핑 분석
        // 1. 모든 쿼리 추출
        const queryRegex = /const\s+(\w+Query)\s*=\s*`(query\s+[^`]+)`/gs;
        const queries: Array<{ varName: string; queryId: string; content: string }> = [];

        let match;
        while ((match = queryRegex.exec(sourceCode)) !== null) {
          const varName = match[1];
          const queryContent = match[2];

          const queryId = varName
            .replace(/Agg/g, 'Aggregation')
            .replace(/agg/g, 'aggregation')
            .replace(/Query$/, '')
            .replace(/([A-Z])/g, '-$1')
            .toLowerCase()
            .replace(/^-/, '')
            .replace(/-query$/, '')
            + '-query';

          queries.push({ varName, queryId, content: queryContent });
        }

        console.log('[useEnableEditMode] Found queries:', queries.map(q => ({ varName: q.varName, queryId: q.queryId })));

        if (queries.length === 0) {
          console.warn('[useEnableEditMode] No queries found in source code');
          return;
        }

        // 2. 주석에서 data-query-id를 찾아서 컴포넌트와 매칭
        // 패턴: // data-query-id="review-summary-aggregation-query"
        // 바로 다음에 <StatCard 또는 <DynamicXxxChart 또는 <DynamicDataTable
        let matchedQuery = null;

        // 소스 코드를 줄 단위로 분리
        const lines = sourceCode.split('\n');

        // 각 쿼리에 대해 주석을 찾고, 주석 아래 컴포넌트의 title 추출
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          // 주석에서 data-query-id 찾기
          const commentMatch = line.match(/\/\/\s*data-query-id=["']([^"']+)["']/);
          if (!commentMatch) continue;

          const commentQueryId = commentMatch[1];
          console.log('[useEnableEditMode] Found comment with query ID:', commentQueryId, 'at line', i);

          // 해당 query ID와 일치하는 쿼리 찾기
          const query = queries.find(q => q.queryId === commentQueryId);
          if (!query) {
            console.warn('[useEnableEditMode] Query not found for comment:', commentQueryId);
            continue;
          }

          // 주석 다음 줄부터 컴포넌트 시작 찾기 (최대 5줄)
          for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
            const componentLine = lines[j];

            // 컴포넌트 시작 확인
            const componentMatch = componentLine.match(/<(StatCard|Dynamic(?:Bar|Line|Area|Composed|Pie)Chart|DynamicDataTable)/);
            if (!componentMatch) continue;

            const componentType = componentMatch[1];
            console.log('[useEnableEditMode] Found component:', componentType, 'at line', j);

            // 컴포넌트 내부에서 title 찾기 (다음 10줄 정도)
            let componentTitle = null;
            for (let k = j; k < Math.min(j + 15, lines.length); k++) {
              const titleLine = lines[k];

              // title prop의 EditableText에서 텍스트 추출
              const titleMatch = titleLine.match(/title=\{[^}]*<EditableText[^>]*>\s*([^<]+)\s*<\/EditableText>/);
              if (titleMatch) {
                componentTitle = titleMatch[1].trim();
                console.log('[useEnableEditMode] Extracted title:', componentTitle, 'at line', k);
                break;
              }

              // 컴포넌트가 끝나면 중단 (닫는 태그나 다음 컴포넌트 시작)
              if (titleLine.includes('/>') || titleLine.match(/<\/(?:StatCard|Dynamic)/)) {
                break;
              }
            }

            // title이 클릭한 카드의 title과 일치하는지 확인
            if (componentTitle && cardTitle && componentTitle.toLowerCase().includes(cardTitle.toLowerCase())) {
              matchedQuery = query;
              console.log('[useEnableEditMode] Matched query by comment:', query.queryId, 'with title:', componentTitle);
              break;
            }

            break; // 컴포넌트를 찾았으면 더 이상 찾지 않음
          }

          if (matchedQuery) break;
        }

        // 매칭된 쿼리가 없으면 첫 번째 쿼리 사용
        const selectedQuery = matchedQuery || queries[0];

        if (!matchedQuery) {
          console.warn('[useEnableEditMode] No matching query found for title:', cardTitle, '- using first query');
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
