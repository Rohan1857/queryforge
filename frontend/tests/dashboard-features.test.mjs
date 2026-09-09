import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

let viteServer;

async function loadModule(modulePath) {
  if (!viteServer) {
    viteServer = await createServer({
      root,
      logLevel: "error",
      server: {
        middlewareMode: true,
      },
    });
  }

  return viteServer.ssrLoadModule(modulePath);
}

function createWidget(overrides = {}) {
  const baseWidget = {
    id: "widget-1",
    dashboard_id: "dashboard-1",
    type: "bar",
    title: "Revenue by Month",
    prompt_used: "Show monthly revenue",
    chart_config: {
      x_field: "month",
      y_fields: ["revenue"],
      aggregation: "sum",
      colors: ["#2563eb"],
      stacked: false,
      show_values: true,
      orientation: "vertical",
      x_axis_label: "Month",
      y_axis_label: "Revenue",
      metric_name: "revenue",
      card_description: "Monthly revenue trend",
      show_legend: true,
      show_tooltip: true,
      show_grid: true,
      histogram_bins: 8,
      metric_config: {
        field: "revenue",
        aggregation: "sum",
        percentile: 90,
        moving_average_window: 2,
        top_values_limit: 2,
        show_in_header: true,
        visible_metrics: ["sum", "average"],
      },
      style_config: {},
    },
    layout_position: {
      x: 0,
      y: 0,
      w: 6,
      h: 4,
      position: 0,
    },
    data: [
      { month: "Jan", revenue: 100, region: "North" },
      { month: "Feb", revenue: 100, region: "South" },
      { month: "Mar", revenue: 200, region: "East" },
      { month: "Apr", revenue: 400, region: "West" },
    ],
    cached_data: undefined,
    created_at: "2026-03-15T00:00:00.000Z",
  };

  const chartConfigOverride = overrides.chart_config || {};
  const metricConfigOverride = chartConfigOverride.metric_config || {};
  const styleConfigOverride = chartConfigOverride.style_config || {};

  return {
    ...baseWidget,
    ...overrides,
    chart_config: {
      ...baseWidget.chart_config,
      ...chartConfigOverride,
      metric_config: {
        ...baseWidget.chart_config.metric_config,
        ...metricConfigOverride,
      },
      style_config: {
        ...baseWidget.chart_config.style_config,
        ...styleConfigOverride,
      },
    },
    layout_position: {
      ...baseWidget.layout_position,
      ...(overrides.layout_position || {}),
    },
    data: overrides.data || baseWidget.data,
  };
}

test.after(async () => {
  if (viteServer) {
    await viteServer.close();
  }
});

test("computeWidgetSummary returns the requested dashboard statistics", async () => {
  const { computeWidgetSummary } = await loadModule("/src/lib/widgetStats.ts");
  const widget = createWidget();

  const summary = computeWidgetSummary(widget);

  assert.equal(summary.metricField, "revenue");
  assert.equal(summary.metrics.count.raw, 4);
  assert.equal(summary.metrics.sum.raw, 800);
  assert.equal(summary.metrics.average.raw, 200);
  assert.equal(summary.metrics.median.raw, 150);
  assert.equal(summary.metrics.mode.raw, 100);
  assert.equal(summary.metrics.minimum.raw, 100);
  assert.equal(summary.metrics.maximum.raw, 400);
  assert.equal(summary.metrics.range.raw, 300);
  assert.equal(summary.metrics.growth_rate.raw, 300);
  assert.deepEqual(summary.headerMetrics.map((metric) => metric.id), ["sum", "average"]);
  assert.deepEqual(summary.topValues, [
    { label: "Apr", value: 400 },
    { label: "Mar", value: 200 },
  ]);
});

test("summary metrics recompute when the dataset changes", async () => {
  const { computeWidgetSummary } = await loadModule("/src/lib/widgetStats.ts");
  const widget = createWidget();
  const updatedWidget = createWidget({
    data: [
      { month: "Jan", revenue: 50, region: "North" },
      { month: "Feb", revenue: 75, region: "South" },
      { month: "Mar", revenue: 125, region: "East" },
      { month: "Apr", revenue: 250, region: "West" },
    ],
  });

  const initialSummary = computeWidgetSummary(widget);
  const updatedSummary = computeWidgetSummary(updatedWidget);

  assert.equal(initialSummary.metrics.sum.raw, 800);
  assert.equal(updatedSummary.metrics.sum.raw, 500);
  assert.notEqual(initialSummary.metrics.average.raw, updatedSummary.metrics.average.raw);
});

test("buildChartTypeUpdate normalizes aliases and preserves chart-specific flags", async () => {
  const { buildChartTypeUpdate } = await loadModule("/src/lib/widgetConfig.ts");
  const widget = createWidget();

  const stackedUpdate = buildChartTypeUpdate(widget, "stacked_bar_chart");
  const donutUpdate = buildChartTypeUpdate(widget, "donut_chart");

  assert.equal(stackedUpdate.type, "stacked_bar");
  assert.equal(stackedUpdate.chart_config.stacked, true);
  assert.equal(stackedUpdate.chart_config.metric_name, "revenue");
  assert.equal(donutUpdate.type, "donut");
  assert.equal(donutUpdate.chart_config.donut, true);
});

test("dashboard store updateLayout reorders cards and persists explicit positions", async () => {
  globalThis.localStorage = {
    getItem() {
      return null;
    },
    setItem() {},
    removeItem() {},
    clear() {},
  };
  globalThis.window = {
    location: {
      href: "",
    },
  };

  const { dashboardApi } = await loadModule("/src/lib/api.ts");
  const { useDashboardStore } = await loadModule("/src/stores/dashboardStore.ts");

  const firstWidget = createWidget({
    id: "widget-a",
    title: "First",
    layout_position: { x: 0, y: 0, w: 6, h: 4, position: 0 },
  });
  const secondWidget = createWidget({
    id: "widget-b",
    title: "Second",
    layout_position: { x: 6, y: 0, w: 6, h: 4, position: 1 },
  });

  let capturedLayout = null;
  const originalUpdateLayout = dashboardApi.updateLayout;
  dashboardApi.updateLayout = async (_dashboardId, items) => {
    capturedLayout = items;
    return { updated: true };
  };

  useDashboardStore.setState({
    dashboards: [],
    currentDashboard: {
      id: "dashboard-1",
      title: "Test Dashboard",
      description: "",
      layout: {},
      settings: {},
      is_public: false,
      widget_count: 2,
      widgets: [firstWidget, secondWidget],
      created_at: "2026-03-15T00:00:00.000Z",
      updated_at: "2026-03-15T00:00:00.000Z",
    },
    widgets: [firstWidget, secondWidget],
    isLoading: false,
  });

  await useDashboardStore.getState().updateLayout("dashboard-1", [
    { id: "widget-b", x: 0, y: 0, w: 6, h: 4 },
    { id: "widget-a", x: 6, y: 0, w: 6, h: 4 },
  ]);

  assert.deepEqual(
    useDashboardStore.getState().widgets.map((widget) => widget.id),
    ["widget-b", "widget-a"],
  );
  assert.ok(capturedLayout);
  assert.deepEqual(
    capturedLayout.map((item) => ({ id: item.id, position: item.position })),
    [
      { id: "widget-b", position: 0 },
      { id: "widget-a", position: 1 },
    ],
  );

  dashboardApi.updateLayout = originalUpdateLayout;
});
