function Avatar({ employee, photoUrl }) {
  const initials = String(employee.name || "U")
    .split(" ")
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();

  if (photoUrl) {
    return <img src={photoUrl} alt={`${employee.name || "Employee"} avatar`} className="employee-avatar" />;
  }

  return <div className="employee-avatar employee-avatar-fallback">{initials || "U"}</div>;
}

function RowActions({ employee, onProfile, onEdit, onDeactivate, onPhotoUpload }) {
  return (
    <div className="employee-actions">
      <button onClick={() => onProfile(employee)} aria-label={`View ${employee.name} profile`}>
        <i className="bi bi-person-vcard" />
      </button>
      <button onClick={() => onEdit(employee)} disabled={!employee.is_active || employee.is_demo} aria-label={`Edit ${employee.name}`}>
        <i className="bi bi-pencil-square" />
      </button>
      {employee.is_active && (
        <button onClick={() => onDeactivate(employee)} disabled={employee.is_demo} aria-label={`Exit ${employee.name}`}>
          <i className="bi bi-box-arrow-right" />
        </button>
      )}
      <label className="photo-upload-btn" aria-label={`Upload photo for ${employee.name}`}>
        <i className="bi bi-image" />
        <input type="file" accept="image/*" onChange={(e) => onPhotoUpload(employee, e.target.files?.[0] || null)} />
      </label>
    </div>
  );
}

const EmployeeList = ({
  employees,
  onEdit,
  onDeactivate,
  onProfile,
  viewMode,
  photoMap,
  onPhotoUpload,
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="employee-skeleton-grid">
        <span />
        <span />
        <span />
      </div>
    );
  }

  if (!employees.length) {
    return <div className="employee-empty">No employees found for selected filters.</div>;
  }

  if (viewMode === "grid") {
    return (
      <div className="employee-grid-view">
        {employees.map((emp) => (
          <article key={emp.id} className={`employee-grid-card ${emp.is_active ? "" : "employee-row-exited"}`}>
            <div className="employee-grid-top">
              <Avatar employee={emp} photoUrl={photoMap[emp.emp_id]} />
              <div>
                <strong>{emp.name}</strong>
                <p>{emp.emp_id}</p>
              </div>
            </div>
            <div className="employee-grid-meta">
              <span>{emp.designation || "-"}</span>
              <span>{emp.department || "-"}</span>
              <span>{emp.joining_date || "-"}</span>
            </div>
            <span className={emp.is_active ? "status-badge status-active" : "status-badge status-exited"}>
              {emp.is_active ? "Active" : "Exited"}
            </span>
            <RowActions
              employee={emp}
              onProfile={onProfile}
              onEdit={onEdit}
              onDeactivate={onDeactivate}
              onPhotoUpload={onPhotoUpload}
            />
          </article>
        ))}
      </div>
    );
  }

  return (
    <div className="employee-table-wrap">
      <table className="employee-table">
        <thead>
          <tr>
            <th>Employee</th>
            <th>Designation</th>
            <th>Department</th>
            <th>Joining Date</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((emp) => (
            <tr key={emp.id} className={emp.is_active ? "" : "employee-row-exited"}>
              <td>
                <div className="employee-cell-main">
                  <Avatar employee={emp} photoUrl={photoMap[emp.emp_id]} />
                  <div>
                    <strong>{emp.name}</strong>
                    <p>{emp.emp_id}</p>
                  </div>
                </div>
              </td>
              <td>{emp.designation || "-"}</td>
              <td>{emp.department || "-"}</td>
              <td>{emp.joining_date || "-"}</td>
              <td>
                <span className={emp.is_active ? "status-badge status-active" : "status-badge status-exited"}>
                  {emp.is_active ? "Active" : "Exited"}
                </span>
              </td>
              <td>
                <RowActions
                  employee={emp}
                  onProfile={onProfile}
                  onEdit={onEdit}
                  onDeactivate={onDeactivate}
                  onPhotoUpload={onPhotoUpload}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default EmployeeList;
