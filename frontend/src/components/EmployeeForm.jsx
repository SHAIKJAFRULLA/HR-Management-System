import { useMemo, useState } from "react";

const initialForm = {
  emp_id: "",
  name: "",
  designation: "",
  department: "",
  contact_number: "",
  email: "",
  joining_date: "",
};

const EmployeeForm = ({ onSubmit, selected, submitting, mode = "create" }) => {
  const [formData, setFormData] = useState({
    ...initialForm,
    ...selected,
  });
  const [touched, setTouched] = useState({});

  const errors = useMemo(() => {
    const e = {};
    if (!formData.emp_id) e.emp_id = "Emp ID is required";
    if (!formData.name) e.name = "Name is required";
    if (!formData.designation) e.designation = "Designation is required";
    if (!formData.department) e.department = "Department is required";
    if (!/^\d{10,15}$/.test(formData.contact_number || "")) e.contact_number = "Contact must be 10-15 digits";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email || "")) e.email = "Valid email is required";
    if (!formData.joining_date) e.joining_date = "Joining date is required";
    return e;
  }, [formData]);

  const hasErrors = Object.keys(errors).length > 0;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched({
      emp_id: true,
      name: true,
      designation: true,
      department: true,
      contact_number: true,
      email: true,
      joining_date: true,
    });
    if (hasErrors) return;

    onSubmit({
      emp_id: formData.emp_id || "",
      name: formData.name || "",
      designation: formData.designation || "",
      department: formData.department || "",
      contact_number: formData.contact_number || "",
      email: formData.email || "",
      joining_date: formData.joining_date || "",
    });
  };

  function renderField(name, label, type = "text", extra = {}) {
    return (
      <label className="form-field">
        <span>{label}</span>
        <input
          type={type}
          name={name}
          placeholder={label}
          value={formData[name] || ""}
          onChange={handleChange}
          onBlur={() => setTouched((prev) => ({ ...prev, [name]: true }))}
          disabled={submitting || extra.disabled}
          {...extra}
        />
        {touched[name] && errors[name] && <small className="field-error">{errors[name]}</small>}
      </label>
    );
  }

  return (
    <form className="employee-form-grid" onSubmit={handleSubmit}>
      {renderField("emp_id", "Emp ID", "text", {
        pattern: "[0-9]+",
        title: "Emp ID must be numeric",
        disabled: mode === "edit",
      })}
      {renderField("name", "Name")}
      {renderField("designation", "Designation")}
      {renderField("department", "Department")}
      {renderField("contact_number", "Contact Number", "text", {
        pattern: "[0-9]{10,15}",
        title: "Enter 10 to 15 digits",
      })}
      {renderField("email", "Email", "email")}
      {renderField("joining_date", "Joining Date", "date", { disabled: mode === "edit" })}
      <button type="submit" disabled={submitting || hasErrors}>
        {submitting ? "Saving..." : mode === "edit" ? "Update Employee" : "Create Employee"}
      </button>
    </form>
  );
};

export default EmployeeForm;
