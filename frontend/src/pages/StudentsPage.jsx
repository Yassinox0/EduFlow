import { useEffect, useMemo, useState } from "react";
import { getStudents } from "../services/studentService";

const formatMoney = (value) =>
  new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD" }).format(
    Number(value || 0)
  );

export default function StudentsPage() {
  const [students, setStudents] = useState([]);

  useEffect(() => {
    getStudents().then(setStudents).catch(() => null);
  }, []);

  const averageMonthlyFee = useMemo(() => {
    if (!students.length) {
      return 0;
    }
    const total = students.reduce((sum, item) => sum + Number(item.monthly_amount || 0), 0);
    return total / students.length;
  }, [students]);

  return (
    <div className="admin-grid">
      <section className="panel">
        <h2>Students</h2>
        <p className="muted">Master data for billing and tuition follow-up.</p>
      </section>

      <section className="kpi-grid two-col">
        <article className="panel kpi">
          <p className="kpi-label">Registered students</p>
          <h2>{students.length}</h2>
          <p className="muted">Active records in the system</p>
        </article>
        <article className="panel kpi">
          <p className="kpi-label">Average monthly fee</p>
          <h2>{formatMoney(averageMonthlyFee)}</h2>
          <p className="muted">Mean tuition amount per student</p>
        </article>
      </section>

      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Last name</th>
                <th>First name</th>
                <th>Class</th>
                <th>Parent</th>
                <th>Phone</th>
                <th>Monthly fee</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id}>
                  <td>{student.last_name}</td>
                  <td>{student.first_name}</td>
                  <td>{student.class_level}</td>
                  <td>{student.parent_name}</td>
                  <td>{student.phone}</td>
                  <td>{formatMoney(student.monthly_amount)}</td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr>
                  <td colSpan="6" className="table-empty">
                    No students found.
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
