import { useContext } from "react";
import { I18nContext } from "../context/I18nContext";

export default function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider");
  }
  return context;
}
