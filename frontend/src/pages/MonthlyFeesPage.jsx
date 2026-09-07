import { useMemo, useState } from "react";
import { SCHOOL_YEAR_MONTH_OPTIONS } from "../config/schoolOptions";
import { getMonthlyFees } from "../services/monthlyFeeService";
import useI18n from "../hooks/useI18n";

const formatMoney = (value, language) =>
  new Intl.NumberFormat(language === "ar" ? "ar-MA" : "fr-MA", { style: "currency", currency: "MAD" }).format(
    Number(value || 0)
  );

const statusLabel = (value, t) => {
  if (value === "PAID") return t("statuses.paid");
  if (value === "PARTIAL") return t("statuses.partial");
  if (value === "UNPAID") return t("statuses.unpaid");
  return value || "-";
};

export default function MonthlyFeesPage() {
  const { language, t } = useI18n();
  const [monthlyFees, setMonthlyFees] = useState([]);
  const [filters, setFilters] = useState({
    search: "",
    class_level: "",
    class_name: "",
    month_label: "09",
    year_value: "",
    status: "",
  });
  const [filtersApplied, setFiltersApplied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadData = async (params) => {
    const data = await getMonthlyFees(params);
    setMonthlyFees(Array.isArray(data) ? data : []);
  };

  const totals = useMemo(() => {
    return monthlyFees.reduce(
      (acc, item) => {
        acc.total += Number(item.total_amount || 0);
        acc.paid += Number(item.amount_paid || 0);
        acc.remaining += Number(item.remaining_amount || 0);
        return acc;
      },
      { total: 0, paid: 0, remaining: 0 }
    );
  }, [monthlyFees]);

  const applyFilters = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const params = {
        search: filters.search || undefined,
        class_level: filters.class_level || undefined,
        class_name: filters.class_name || undefined,
        month_label: filters.month_label || undefined,
        year_value: filters.year_value || undefined,
        status: filters.status || undefined,
      };
      await loadData(params);
      setFiltersApplied(true);
    } catch {
      setMonthlyFees([]);
      setFiltersApplied(false);
      setError(t("monthlyFees.loadError"));
    } finally {
      setLoading(false);
    }
  };

  const resetFilters = () => {
    setFilters({
      search: "",
      class_level: "",
      class_name: "",
      month_label: "09",
      year_value: "",
      status: "",
    });
    setMonthlyFees([]);
    setFiltersApplied(false);
    setError("");
  };

  return (
    <div className="admin-grid">
      <section className="panel">
        <h2>{t("monthlyFees.title")}</h2>
        <p className="muted">{t("monthlyFees.description")}</p>
      </section>

      <section className="kpi-grid three-col">
        <article className="panel kpi">
          <p className="kpi-label">{t("monthlyFees.totalBilled")}</p>
          <h2>{formatMoney(totals.total, language)}</h2>
        </article>
        <article className="panel kpi">
          <p className="kpi-label">{t("monthlyFees.totalCollected")}</p>
          <h2>{formatMoney(totals.paid, language)}</h2>
        </article>
        <article className="panel kpi">
          <p className="kpi-label">{t("monthlyFees.totalRemaining")}</p>
          <h2>{formatMoney(totals.remaining, language)}</h2>
        </article>
      </section>

      <section className="panel">
        <h3>{t("monthlyFees.filters")}</h3>
        <form className="form-grid" onSubmit={applyFilters}>
          <select
            value={filters.month_label}
            onChange={(e) => setFilters({ ...filters, month_label: e.target.value })}
          >
            {SCHOOL_YEAR_MONTH_OPTIONS.map((month) => (
              <option key={month.value} value={month.value}>{t(`months.${month.value}`)}</option>
            ))}
          </select>
          <input
            placeholder={t("monthlyFees.searchStudent")}
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
          <input
            placeholder={t("monthlyFees.filterLevel")}
            value={filters.class_level}
            onChange={(e) => setFilters({ ...filters, class_level: e.target.value })}
          />
          <input
            placeholder={t("monthlyFees.filterClass")}
            value={filters.class_name}
            onChange={(e) => setFilters({ ...filters, class_name: e.target.value })}
          />
          <input
            type="number"
            placeholder={t("common.year")}
            value={filters.year_value}
            onChange={(e) => setFilters({ ...filters, year_value: e.target.value })}
          />
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">{t("monthlyFees.allStatuses")}</option>
            <option value="PAID">{t("statuses.paid")}</option>
            <option value="PARTIAL">{t("statuses.partial")}</option>
            <option value="UNPAID">{t("statuses.unpaid")}</option>
          </select>
          <button type="button" className="secondary-btn" onClick={resetFilters}>
            {t("common.reset")}
          </button>
          <button type="submit" disabled={loading}>
            {loading ? t("common.loading") : t("common.apply")}
          </button>
        </form>
        {error && <p className="error-text">{error}</p>}
      </section>

      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("common.student")}</th>
                <th>{t("common.level")}</th>
                <th>{t("monthlyFees.month")}</th>
                <th>{t("common.year")}</th>
                <th>{t("monthlyFees.billed")}</th>
                <th>{t("monthlyFees.paid")}</th>
                <th>{t("monthlyFees.remaining")}</th>
                <th>{t("common.status")}</th>
              </tr>
            </thead>
            <tbody>
              {monthlyFees.map((fee) => (
                <tr key={fee.id}>
                  <td>
                    {fee.first_name} {fee.last_name}
                  </td>
                  <td>{fee.class_level_name || "-"}</td>
                  <td>{t(`months.${String(fee.month_label).padStart(2, "0")}`)}</td>
                  <td>{fee.year_value}</td>
                  <td>{formatMoney(fee.total_amount, language)}</td>
                  <td>{formatMoney(fee.amount_paid, language)}</td>
                  <td>{formatMoney(fee.remaining_amount, language)}</td>
                  <td>{statusLabel(fee.status, t)}</td>
                </tr>
              ))}
              {monthlyFees.length === 0 && (
                <tr>
                  <td colSpan="8" className="table-empty">
                    {filtersApplied ? t("monthlyFees.emptyFiltered") : t("monthlyFees.emptyInitial")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
