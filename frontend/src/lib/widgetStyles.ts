import type { CSSProperties } from "react";
import type { WidgetStyleConfig } from "@/types/widget";

export function getCardContainerStyle(
  styleConfig: WidgetStyleConfig,
  hovered: boolean,
): CSSProperties {
  const background =
    styleConfig.background_type === "gradient"
      ? `linear-gradient(135deg, ${styleConfig.gradient_from}, ${styleConfig.gradient_to})`
      : styleConfig.background_type === "image" && styleConfig.background_image
        ? `url(${styleConfig.background_image}) center / cover no-repeat`
        : styleConfig.background_color;

  return {
    background,
    borderColor: styleConfig.border_color,
    borderWidth: styleConfig.border_width,
    borderStyle: "solid",
    borderRadius: styleConfig.border_radius,
    boxShadow: hovered ? styleConfig.hover_shadow : styleConfig.card_shadow,
    textAlign: styleConfig.alignment,
    transition: "box-shadow 180ms ease, transform 180ms ease, border-color 180ms ease",
    transform: hovered ? "translateY(-1px)" : "translateY(0)",
    outline: styleConfig.highlight_border ? "2px solid rgba(37, 99, 235, 0.28)" : "none",
    outlineOffset: styleConfig.highlight_border ? "1px" : undefined,
  };
}

export function getWidgetTextStyle(styleConfig: WidgetStyleConfig): CSSProperties {
  return {
    fontSize: styleConfig.font_size,
    fontWeight: styleConfig.bold ? 700 : styleConfig.font_weight,
    fontStyle: styleConfig.italic ? "italic" : "normal",
    textAlign: styleConfig.alignment,
  };
}
