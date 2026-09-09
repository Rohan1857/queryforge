import { create } from "zustand";
import { dashboardApi, promptApi, widgetApi } from "@/lib/api";
import { applyLayoutToWidgets, mergeWidget, sortWidgets, syncCurrentDashboard } from "@/lib/dashboardState";
import {
  buildAggregationModificationPrompt,
  buildOrderedLayout,
  createChartConfig,
  getMetricField,
  getWidgetFieldOptions,
  getWidgetMetricConfig,
  getWidgetStyleConfig,
} from "@/lib/widgetConfig";
import type { Dashboard, DashboardCreate, DashboardDetail, DashboardUpdate, LayoutItem } from "@/types/dashboard";
import type { Widget, WidgetMetricConfig, WidgetUpdate } from "@/types/widget";

interface DashboardState {
  dashboards: Dashboard[];
  currentDashboard: DashboardDetail | null;
  widgets: Widget[];
  isLoading: boolean;

  fetchDashboards: () => Promise<void>;
  fetchDashboard: (id: string) => Promise<void>;
  createDashboard: (data: DashboardCreate) => Promise<Dashboard>;
  deleteDashboard: (id: string) => Promise<void>;
  updateDashboard: (id: string, data: DashboardUpdate) => Promise<Dashboard>;
  updateLayout: (id: string, items: LayoutItem[]) => Promise<void>;

  addWidget: (widget: Widget) => void;
  updateWidget: (id: string, data: WidgetUpdate) => Promise<void>;
  duplicateWidget: (id: string) => Promise<Widget>;
  removeWidget: (id: string) => Promise<void>;
  refreshWidget: (id: string) => Promise<void>;
  regenerateWidgetAggregation: (
    widget: Widget,
    aggregation: WidgetMetricConfig["aggregation"],
  ) => Promise<void>;
  setWidgets: (widgets: Widget[]) => void;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  dashboards: [],
  currentDashboard: null,
  widgets: [],
  isLoading: false,

  fetchDashboards: async () => {
    set({ isLoading: true });
    try {
      const dashboards = await dashboardApi.list();
      set({ dashboards });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchDashboard: async (id) => {
    set({ isLoading: true });
    try {
      const dashboard = await dashboardApi.get(id);
      const widgets = sortWidgets(dashboard.widgets || []);
      set({
        currentDashboard: { ...dashboard, widgets },
        widgets,
      });
    } finally {
      set({ isLoading: false });
    }
  },

  createDashboard: async (data) => {
    const dashboard = await dashboardApi.create(data);
    set({ dashboards: [...get().dashboards, dashboard] });
    return dashboard;
  },

  deleteDashboard: async (id) => {
    await dashboardApi.delete(id);
    set({ dashboards: get().dashboards.filter((d) => d.id !== id) });
  },

  updateDashboard: async (id, data) => {
    const previousDashboard = get().currentDashboard;
    const previousDashboards = get().dashboards;
    const optimisticCurrent =
      previousDashboard && previousDashboard.id === id
        ? {
            ...previousDashboard,
            ...data,
            settings: data.settings ?? previousDashboard.settings,
          }
        : previousDashboard;
    const optimisticDashboards = previousDashboards.map((dashboard) =>
      dashboard.id === id
        ? {
            ...dashboard,
            ...data,
            settings: data.settings ?? dashboard.settings,
          }
        : dashboard,
    );

    set({
      currentDashboard: optimisticCurrent,
      dashboards: optimisticDashboards,
    });

    try {
      const updated = await dashboardApi.update(id, data);
      set({
        currentDashboard:
          get().currentDashboard && get().currentDashboard?.id === id
            ? {
                ...get().currentDashboard!,
                ...updated,
                widgets: get().widgets,
              }
            : get().currentDashboard,
        dashboards: get().dashboards.map((dashboard) =>
          dashboard.id === id ? { ...dashboard, ...updated } : dashboard,
        ),
      });
      return updated;
    } catch (error) {
      set({
        currentDashboard: previousDashboard,
        dashboards: previousDashboards,
      });
      throw error;
    }
  },

  updateLayout: async (id, items) => {
    const previousWidgets = get().widgets;
    const orderedItems = buildOrderedLayout(items);
    const nextWidgets = applyLayoutToWidgets(previousWidgets, orderedItems);
    set({
      widgets: nextWidgets,
      currentDashboard: syncCurrentDashboard(get().currentDashboard, nextWidgets),
    });

    try {
      await dashboardApi.updateLayout(id, orderedItems);
    } catch (error) {
      set({
        widgets: previousWidgets,
        currentDashboard: syncCurrentDashboard(get().currentDashboard, previousWidgets),
      });
      throw error;
    }
  },

  addWidget: (widget) => {
    const widgets = sortWidgets([...get().widgets, widget]);
    set({
      widgets,
      currentDashboard: syncCurrentDashboard(get().currentDashboard, widgets),
    });
  },

  updateWidget: async (id, data) => {
    const previousWidgets = get().widgets;
    const optimisticWidgets = sortWidgets(
      previousWidgets.map((widget) => (widget.id === id ? mergeWidget(widget, data) : widget)),
    );

    set({
      widgets: optimisticWidgets,
      currentDashboard: syncCurrentDashboard(get().currentDashboard, optimisticWidgets),
    });

    try {
      const updated = await widgetApi.update(id, data);
      const reconciledWidgets = sortWidgets(
        get().widgets.map((widget) => (widget.id === id ? updated : widget)),
      );
      set({
        widgets: reconciledWidgets,
        currentDashboard: syncCurrentDashboard(get().currentDashboard, reconciledWidgets),
      });
    } catch (error) {
      set({
        widgets: previousWidgets,
        currentDashboard: syncCurrentDashboard(get().currentDashboard, previousWidgets),
      });
      throw error;
    }
  },

  duplicateWidget: async (id) => {
    const duplicated = await widgetApi.duplicate(id);
    const widgets = sortWidgets([...get().widgets, duplicated]);
    set({
      widgets,
      currentDashboard: syncCurrentDashboard(get().currentDashboard, widgets),
    });
    return duplicated;
  },

  removeWidget: async (id) => {
    const previousWidgets = get().widgets;
    const nextWidgets = previousWidgets.filter((widget) => widget.id !== id);

    set({
      widgets: nextWidgets,
      currentDashboard: syncCurrentDashboard(get().currentDashboard, nextWidgets),
    });

    try {
      await widgetApi.delete(id);
    } catch (error) {
      set({
        widgets: previousWidgets,
        currentDashboard: syncCurrentDashboard(get().currentDashboard, previousWidgets),
      });
      throw error;
    }
  },

  refreshWidget: async (id) => {
    const updated = await widgetApi.refresh(id);
    const widgets = sortWidgets(get().widgets.map((widget) => (widget.id === id ? updated : widget)));
    set({
      widgets,
      currentDashboard: syncCurrentDashboard(get().currentDashboard, widgets),
    });
  },

  regenerateWidgetAggregation: async (widget, aggregation) => {
    const metricConfig = getWidgetMetricConfig(widget);
    const styleConfig = getWidgetStyleConfig(widget);
    const palette =
      Array.isArray(widget.chart_config.colors) && widget.chart_config.colors.length > 0
        ? widget.chart_config.colors
        : undefined;
    const previousMetricField = metricConfig.field || getMetricField(widget);

    await promptApi.modifyWidget(
      widget.id,
      buildAggregationModificationPrompt(widget, aggregation),
    );

    const regenerated = await widgetApi.get(widget.id);
    const regeneratedFieldOptions = getWidgetFieldOptions(regenerated);
    const regeneratedMetricField = getMetricField(regenerated);
    const nextMetricField = regeneratedFieldOptions.numericFields.includes(previousMetricField)
      ? previousMetricField
      : regeneratedMetricField;
    const nextYFields =
      regenerated.chart_config.y_fields && regenerated.chart_config.y_fields.length > 0
        ? regenerated.chart_config.y_fields
        : nextMetricField
          ? [nextMetricField]
          : [];
    const updated = await widgetApi.update(widget.id, {
      chart_config: createChartConfig(regenerated, {
        colors: palette,
        card_description:
          widget.chart_config.card_description ?? regenerated.chart_config.card_description,
        x_axis_label: widget.chart_config.x_axis_label ?? regenerated.chart_config.x_axis_label,
        y_axis_label: widget.chart_config.y_axis_label ?? regenerated.chart_config.y_axis_label,
        metric_name: nextMetricField || regeneratedMetricField,
        ...(nextYFields.length > 0 ? { y_fields: nextYFields } : {}),
        style_config: styleConfig,
        metric_config: {
          ...metricConfig,
          aggregation,
          field: nextMetricField || regeneratedMetricField,
        },
      }),
    });

    const widgets = sortWidgets(
      get().widgets.map((current) => (current.id === widget.id ? updated : current)),
    );
    set({
      widgets,
      currentDashboard: syncCurrentDashboard(get().currentDashboard, widgets),
    });
  },

  setWidgets: (widgets) => {
    const sortedWidgets = sortWidgets(widgets);
    set({
      widgets: sortedWidgets,
      currentDashboard: syncCurrentDashboard(get().currentDashboard, sortedWidgets),
    });
  },
}));
