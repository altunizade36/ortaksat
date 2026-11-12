import { forwardRef } from "react";
import { ScrollView, type ScrollViewProps } from "react-native";

/** Intrinsic-height horizontal content inside a fill-height vertical page.
 * ScrollView grows by default, so unbounded chip rows otherwise consume page space.
 * Fullscreen/paging galleries should continue using a regular ScrollView.
 */
export const HorizontalScroll = forwardRef<ScrollView, Omit<ScrollViewProps, "horizontal">>(function HorizontalScroll({ style, contentContainerStyle, testID, ...props }, ref) {
  return <ScrollView {...props} ref={ref} horizontal testID={testID || "horizontal-strip"} style={[style, { flexGrow: 0, flexShrink: 0 }]} contentContainerStyle={[contentContainerStyle, { alignItems: "center" }]} />;
});
