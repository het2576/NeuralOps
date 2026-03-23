// NeuralOps — WebSocket Custom Hook
import { useState, useEffect, useRef, useCallback } from "react";

export default function useWebSocket(url) {
  const [stats, setStats] = useState(null);
  const [recentRequests, setRecentRequests] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        setLastEvent(message);

        if (message.type === "stats_update") {
          setStats({ ...message.data });
        } else if (message.type === "new_request") {
          setRecentRequests((prev) => [message.data, ...prev].slice(0, 20));
        }
        // health_change → only updates lastEvent (already set above)
      } catch (err) {
        console.error("[WS] Failed to parse message:", err);
      }
    };
  }, [url]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  return { stats, recentRequests, isConnected, lastEvent };
}