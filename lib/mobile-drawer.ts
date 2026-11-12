import { createContext, useContext } from "react";
export const MobileDrawerContext = createContext({ open: () => {}, close: () => {} });
export const useMobileDrawer = () => useContext(MobileDrawerContext);
