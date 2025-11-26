import { useState } from "react";
import { usePostMessageAuth } from "../hooks/usePostMessageAuth";
import { useApiClient, api } from "../api/api.client";
import { AuthStatus } from "../types/auth.types";
import "../App.css";

interface LogEntry {
  id: string;
  timestamp: Date;
  type: "info" | "success" | "error";
  message: string;
}

export function TestPage() {
  const { authState, getToken, refreshToken } = usePostMessageAuth();
  useApiClient(); // Initialize API client

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addLog = (type: LogEntry["type"], message: string) => {
    const log: LogEntry = {
      id: Date.now().toString(),
      timestamp: new Date(),
      type,
      message,
    };
    setLogs((prev) => [log, ...prev].slice(0, 10)); // 최근 10개만 유지
  };

  // 토큰 요청 테스트
  const handleRequestToken = async () => {
    setIsLoading(true);
    addLog("info", "토큰 요청 중...");
    try {
      const token = await getToken();
      addLog("success", `토큰 수신 성공: ${token.substring(0, 20)}...`);
    } catch (error) {
      addLog("error", `토큰 요청 실패: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 토큰 갱신 테스트
  const handleRefreshToken = async () => {
    setIsLoading(true);
    addLog("info", "토큰 갱신 요청 중...");
    try {
      const token = await refreshToken();
      addLog("success", `토큰 갱신 성공: ${token.substring(0, 20)}...`);
    } catch (error) {
      addLog("error", `토큰 갱신 실패: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  // API 호출 테스트
  const handleApiCall = async () => {
    setIsLoading(true);
    addLog("info", "API 호출 중 (GET /test)...");
    try {
      const response = await api.test.get();
      addLog("success", `API 호출 성공: ${JSON.stringify(response.data)}`);
    } catch (error: any) {
      const status = error.response?.status || "Unknown";
      const message = error.response?.data?.message || error.message;
      addLog("error", `API 호출 실패 [${status}]: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 사용자 정보 조회 테스트
  const handleGetUserInfo = async () => {
    setIsLoading(true);
    addLog("info", "API 호출 중 (GET /user/me)...");
    try {
      const response = await api.user.me();
      addLog(
        "success",
        `사용자 정보 조회 성공: ${JSON.stringify(response.data)}`
      );
    } catch (error: any) {
      const status = error.response?.status || "Unknown";
      const message = error.response?.data?.message || error.message;
      addLog("error", `API 호출 실패 [${status}]: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: AuthStatus) => {
    switch (status) {
      case AuthStatus.AUTHENTICATED:
        return "#4ade80"; // green
      case AuthStatus.REQUESTING:
        return "#fbbf24"; // yellow
      case AuthStatus.FAILED:
        return "#f87171"; // red
      default:
        return "#9ca3af"; // gray
    }
  };

  const getStatusText = (status: AuthStatus) => {
    switch (status) {
      case AuthStatus.AUTHENTICATED:
        return "인증됨";
      case AuthStatus.REQUESTING:
        return "요청 중";
      case AuthStatus.FAILED:
        return "실패";
      default:
        return "대기";
    }
  };

  return (
    <div className="container">
      {/* 인증 상태 */}
      <section className="status-section">
        <h2>인증 상태</h2>
        <div className="status-card">
          <div className="status-row">
            <span className="label">상태:</span>
            <span
              className="status-badge"
              style={{ backgroundColor: getStatusColor(authState.status) }}
            >
              {getStatusText(authState.status)}
            </span>
          </div>
          {authState.lastValidated && (
            <div className="status-row">
              <span className="label">마지막 검증:</span>
              <span className="value">
                {authState.lastValidated.toLocaleTimeString()}
              </span>
            </div>
          )}
          {authState.error && (
            <div className="status-row error">
              <span className="label">에러:</span>
              <span className="value">{authState.error}</span>
            </div>
          )}
          <div className="status-row">
            <span className="label">호스트 Origin:</span>
            <span className="value">
              {window.parent !== window
                ? "(iframe에서 실행 중)"
                : "(독립 실행 중)"}
            </span>
          </div>
        </div>
      </section>

      {/* 테스트 버튼 */}
      <section className="actions-section">
        <h2>테스트 기능</h2>
        <div className="button-grid">
          <button
            onClick={handleRequestToken}
            disabled={isLoading}
            className="btn btn-primary"
          >
            토큰 요청
          </button>
          <button
            onClick={handleRefreshToken}
            disabled={isLoading}
            className="btn btn-secondary"
          >
            토큰 갱신
          </button>
          <button
            onClick={handleApiCall}
            disabled={isLoading}
            className="btn btn-success"
          >
            API 호출 (GET /test)
          </button>
          <button
            onClick={handleGetUserInfo}
            disabled={isLoading}
            className="btn btn-info"
          >
            사용자 정보 조회
          </button>
        </div>
      </section>

      {/* 로그 */}
      <section className="logs-section">
        <h2>통신 로그</h2>
        <div className="logs-container">
          {logs.length === 0 ? (
            <p className="empty-message">아직 로그가 없습니다.</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className={`log-entry log-${log.type}`}>
                <span className="log-time">
                  {log.timestamp.toLocaleTimeString()}
                </span>
                <span className="log-message">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </section>

      <footer>
        <p>
          <strong>허용된 Origins:</strong> localhost:3000,
          app-dev.commerceos.ai, app.commerceos.ai
        </p>
        <p>
          <strong>API 엔드포인트:</strong> app-api-v2-dev.commerceos.ai,
          app-api-v2.commerceos.ai
        </p>
      </footer>
    </div>
  );
}
