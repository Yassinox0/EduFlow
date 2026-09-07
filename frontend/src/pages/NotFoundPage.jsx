import useI18n from "../hooks/useI18n";

export default function NotFoundPage() {
  const { t } = useI18n();
  return <div>{t("notFound.message")}</div>;
}
