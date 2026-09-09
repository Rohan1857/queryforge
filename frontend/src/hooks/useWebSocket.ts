import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useDashboardStore } from "@/stores/dashboardStore";
import type { LayoutPosition, Widget } from "@/types/widget";

export function useWebSocket(dashboardId: string | undefined) {
  const socketRef = useRef<Socket | null>(null);
  const { addWidget, fetchDashboard, setWidgets } = useDashboardStore();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!dashboardId || !token) return;

    const socket = io("/dashboard", {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join_dashboard", { dashboard_id: dashboardId });
    });

    socket.on("widget:created", (payload: Widget | { id?: string; widget_id?: string }) => {
      if ("layout_position" in payload) {
        addWidget(payload as Widget);
        return;
      }

      void fetchDashboard(dashboardId);
    });

    socket.on("widget:updated", (payload: Widget | { id?: string; widget_id?: string }) => {
      if ("layout_position" in payload) {
        const current = useDashboardStore.getState().widgets;
        setWidgets(current.map((widget) => (widget.id === payload.id ? payload as Widget : widget)));
        return;
      }

      void fetchDashboard(dashboardId);
    });

    socket.on("widget:deleted", (data: { id?: string; widget_id?: string }) => {
      const deletedId = data.id ?? data.widget_id;
      if (!deletedId) return;
      const current = useDashboardStore.getState().widgets;
      setWidgets(current.filter((widget) => widget.id !== deletedId));
    });

    socket.on("widget:moved", (data: { id?: string; widget_id?: string; layout_position?: LayoutPosition; position?: LayoutPosition }) => {
      const movedId = data.id ?? data.widget_id;
      const layoutPosition = data.layout_position ?? data.position;
      if (!movedId || !layoutPosition) return;
      const current = useDashboardStore.getState().widgets;
      setWidgets(
        current.map((widget) =>
          widget.id === movedId ? { ...widget, layout_position: layoutPosition } : widget,
        ),
      );
    });

    socket.on("dashboard:layout_changed", () => {
      // Re-fetch to get the latest layout
      useDashboardStore.getState().fetchDashboard(dashboardId);
    });

    return () => {
      socket.emit("leave_dashboard", { dashboard_id: dashboardId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [addWidget, dashboardId, fetchDashboard, setWidgets]);

  return socketRef;
}
