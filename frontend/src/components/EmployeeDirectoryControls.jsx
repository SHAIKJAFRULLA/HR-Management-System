const EmployeeDirectoryControls = ({
  search,
  onSearchChange,
  status,
  onStatusChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
  viewMode,
  onViewModeChange,
  photoFilter,
  onPhotoFilterChange,
  departmentOptions,
  selectedDepartments,
  onDepartmentChange,
  roleOptions,
  selectedRoles,
  onRoleChange,
  compliance,
  onComplianceChange,
  onClearFilters,
}) => {
  function onMultiSelectChange(event, handler) {
    const values = Array.from(event.target.selectedOptions).map((o) => o.value);
    handler(values);
  }

  return (
    <div className="directory-controls">
      <div className="directory-main-search">
        <i className="bi bi-search" />
        <input
          type="text"
          className="search-input"
          placeholder="Search by ID, name, department, email"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Search employees"
        />
      </div>

      <div className="directory-actions-row">
        <select className="control-select" value={status} onChange={(e) => onStatusChange(e.target.value)}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="exited">Exited</option>
        </select>

        <select className="control-select" value={photoFilter} onChange={(e) => onPhotoFilterChange(e.target.value)}>
          <option value="all">All Images</option>
          <option value="with_photo">With Photo</option>
          <option value="without_photo">Without Photo</option>
        </select>

        <select className="control-select" value={compliance} onChange={(e) => onComplianceChange(e.target.value)}>
          <option value="all">All Compliance</option>
          <option value="compliant">Compliant</option>
          <option value="pending">Pending</option>
          <option value="non-compliant">Non-Compliant</option>
          <option value="unknown">Unknown</option>
        </select>

        <select className="control-select" value={sortBy} onChange={(e) => onSortByChange(e.target.value)}>
          <option value="name">Sort by Name</option>
          <option value="joining_date">Sort by Joining Date</option>
        </select>

        <button className="btn-secondary" onClick={onSortOrderChange} type="button">
          {sortOrder === "asc" ? "Asc" : "Desc"}
        </button>

        <div className="view-toggle" role="group" aria-label="Layout switch">
          <button
            type="button"
            className={viewMode === "table" ? "active" : ""}
            onClick={() => onViewModeChange("table")}
          >
            <i className="bi bi-table" /> List
          </button>
          <button
            type="button"
            className={viewMode === "grid" ? "active" : ""}
            onClick={() => onViewModeChange("grid")}
          >
            <i className="bi bi-grid-3x3-gap" /> Grid
          </button>
        </div>
      </div>

      <div className="directory-multi-row">
        <label>
          Department
          <select
            multiple
            className="control-select multi"
            value={selectedDepartments}
            onChange={(e) => onMultiSelectChange(e, onDepartmentChange)}
          >
            {departmentOptions.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>
        </label>

        <label>
          Role
          <select
            multiple
            className="control-select multi"
            value={selectedRoles}
            onChange={(e) => onMultiSelectChange(e, onRoleChange)}
          >
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>

        <button type="button" className="btn-secondary clear-filters" onClick={onClearFilters}>
          Clear All Filters
        </button>
      </div>
    </div>
  );
};

export default EmployeeDirectoryControls;
