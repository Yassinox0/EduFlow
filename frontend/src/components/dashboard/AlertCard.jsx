import React from "react";
import useI18n from "../../hooks/useI18n";

const priorityStyles = {
  critical: { symbol: "!" },
  high: { symbol: ">" },
  medium: { symbol: "~" },
  info: { symbol: "i" },
};

export default function AlertCard({ alert }) {
  const { t } = useI18n();
  const level = alert.level || "info";
  const style = priorityStyles[level] || priorityStyles.info;
  const titleKey = `alerts.items.${alert.code}.title`;
  const descriptionKey = `alerts.items.${alert.code}.description`;
  const translatedTitle = t(titleKey);
  const translatedDescription = t(descriptionKey);

  return (
    <article className={`alert-card alert-card-${level}`}>
      <div className="alert-card-icon" aria-hidden="true">{style.symbol}</div>
      <div className="alert-card-content">
        <p className="kpi-label">{translatedTitle === titleKey ? alert.title : translatedTitle}</p>
        <h3>{alert.count}</h3>
        <p className="muted">{translatedDescription === descriptionKey ? alert.description : translatedDescription}</p>
      </div>
      <span className="alert-card-badge" title={t("alerts.priority", { label: t(`alerts.levels.${level}`) })}>
        {t(`alerts.priorities.${level}`)}
      </span>
    </article>
  );
}
