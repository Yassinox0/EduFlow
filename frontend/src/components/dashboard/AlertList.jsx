import React from "react";
import useI18n from "../../hooks/useI18n";
import AlertCard from "./AlertCard";

export default function AlertList({ alerts }) {
  const { t } = useI18n();
  const totalAlerts = (alerts || []).reduce((sum, alert) => sum + Number(alert.count || 0), 0);

  return (
    <section className="panel alerts-panel">
      <div className="panel-header">
        <div>
          <h3>{t("alerts.title")}</h3>
          <p className="muted">{t("alerts.description")}</p>
        </div>
        <span className="alerts-total">{t("alerts.reports", { count: totalAlerts })}</span>
      </div>
      <div className="alerts-grid">
        {(alerts || []).map((alert) => (
          <AlertCard key={alert.code} alert={alert} />
        ))}
        {!(alerts || []).length && (
          <div className="empty-alerts">{t("alerts.empty")}</div>
        )}
      </div>
    </section>
  );
}
