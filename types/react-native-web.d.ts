import "react-native";

// react-native-web accepts a `dataSet` prop on host components and maps it to
// DOM data-* attributes (used for CSS hover/animation hooks). The upstream RN
// types don't declare it, so we augment the shared prop types here.
declare module "react-native" {
  interface ViewProps {
    dataSet?: Record<string, string | number | undefined>;
  }
  interface TextProps {
    dataSet?: Record<string, string | number | undefined>;
  }
  interface PressableProps {
    dataSet?: Record<string, string | number | undefined>;
  }
}
