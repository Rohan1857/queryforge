import type { DashboardDetail, LayoutItem } from "@/types/dashboard";
import type { Widget, WidgetUpdate } from "@/types/widget";
import { buildOrderedLayout } from "@/lib/widgetConfig";

export function sortWidgets(widgets: Widget[]): Widget[] {
  return [...widgets].sort((a, b) => {
    const posA = a.layout_position.position;
    const posB = b.layout_position.position;

    if (typeof posA === "number" && typeof posB === "number" && posA !== posB) {
      return posA - posB;
    }

    if (a.layout_position.y !== b.layout_position.y) {
      return a.layout_position.y - b.layout_position.y;
    }

    if (a.layout_position.x !== b.layout_position.x) {
      return a.layout_position.x - b.layout_position.x;
    }

    return a.created_at.localeCompare(b.created_at);
  });
}

export function applyLayoutToWidgets(widgets: Widget[], items: LayoutItem[]): Widget[] {
  const orderedItems = buildOrderedLayout(items);
  const itemMap = new Map(
    orderedItems.map((item) => [
      item.id,
      {
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        position: item.position,
      },
    ]),
  );

  return sortWidgets(
    widgets.map((widget) => {
      const nextLayout = itemMap.get(widget.id);
      if (!nextLayout) return widget;

      return {
        ...widget,
        layout_position: {
          ...widget.layout_position,
          ...nextLayout,
        },
      };
    }),
  );
}

export function mergeWidget(widget: Widget, data: WidgetUpdate): Widget {
  return {
    ...widget,
    ...(data.title !== undefined ? { title: data.title } : {}),
    ...(data.type !== undefined ? { type: data.type } : {}),
    ...(data.query_config !== undefined
      ? {
          query_config: {
            ...(widget.query_config || {}),
            ...(data.query_config as Widget["query_config"]),
          },
        }
      : {}),
    ...(data.chart_config !== undefined
      ? { chart_config: data.chart_config as Widget["chart_config"] }
      : {}),
    ...(data.layout_position !== undefined
      ? {
          layout_position: {
            ...widget.layout_position,
            ...(data.layout_position as unknown as Widget["layout_position"]),
          },
        }
      : {}),
  };
}

export function syncCurrentDashboard(
  currentDashboard: DashboardDetail | null,
  widgets: Widget[],
): DashboardDetail | null {
  if (!currentDashboard) return null;

  return {
    ...currentDashboard,
    widgets,
    widget_count: widgets.length,
  };
}
