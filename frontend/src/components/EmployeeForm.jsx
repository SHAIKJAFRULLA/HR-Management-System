import { useMemo, useState } from "react";

const initialForm = {
  emp_id: "",
  name: "",
  designation: "",
  department: "",
  contact_number: "",
  email: "",
  joining_date: "",
  bank_account_number: "",
  bank_name: "",
  bank_ifsc_code: "",
  bank_branch_name: "",
  doc_type: "general",
  doc_notes: "",
  doc_file: null,
  verify_doc_id: "",
  verify_status: "verified",
  verify_notes: "",
  bootstrap_onboarding: false,
  role_change_enabled: false,
  role_name: "",
  role_level: "",
  role_ctc_amount: "",
  role_start_date: "",
  role_end_date: "",
  role_remarks: "",
  exit_update_enabled: false,
  exit_last_working_day: "",
  exit_clearance_status: "pending",
  exit_final_settlement_done: false,
  exit_remarks: "",
};

const EmployeeForm = ({ onSubmit, selected, submitting, mode = "create", documents = [] }) => {
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
    const { name, value, type, checked, files } = e.target;
    const nextValue = type === "checkbox" ? checked : type === "file" ? files?.[0] || null : value;
    setFormData((prev) => ({ ...prev, [name]: nextValue }));
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
      extras: {
        bankAccount:
          formData.bank_account_number && formData.bank_name && formData.bank_ifsc_code && formData.bank_branch_name
            ? {
                account_number: formData.bank_account_number,
                bank_name: formData.bank_name,
                ifsc_code: formData.bank_ifsc_code,
                branch_name: formData.bank_branch_name,
              }
            : null,
        uploadDocument: formData.doc_file
          ? {
              doc_type: formData.doc_type || "general",
              notes: formData.doc_notes || "",
              file: formData.doc_file,
            }
          : null,
        verifyDocument: formData.verify_doc_id
          ? {
              doc_id: Number(formData.verify_doc_id),
              status: formData.verify_status || "verified",
              notes: formData.verify_notes || "",
            }
          : null,
        bootstrapOnboarding: Boolean(formData.bootstrap_onboarding),
        roleChange: formData.role_change_enabled
          ? {
              role: formData.role_name || "",
              level: formData.role_level || "",
              ctc_amount: Number(formData.role_ctc_amount || 0),
              start_date: formData.role_start_date || "",
              end_date: formData.role_end_date || null,
              remarks: formData.role_remarks || "",
            }
          : null,
        exitWorkflow: formData.exit_update_enabled
          ? {
              last_working_day: formData.exit_last_working_day || "",
              clearance_status: formData.exit_clearance_status || "pending",
              final_settlement_done: Boolean(formData.exit_final_settlement_done),
              remarks: formData.exit_remarks || "",
            }
          : null,
      },
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

      <div className="form-section-title">Bank Account (optional)</div>
      {renderField("bank_account_number", "Account Number")}
      {renderField("bank_name", "Bank Name")}
      {renderField("bank_ifsc_code", "IFSC Code")}
      {renderField("bank_branch_name", "Branch Name")}

      <div className="form-section-title">Document Upload (optional)</div>
      {renderField("doc_type", "Document Type")}
      {renderField("doc_notes", "Document Notes")}
      <label className="form-field">
        <span>Document File</span>
        <input type="file" name="doc_file" onChange={handleChange} disabled={submitting} />
      </label>

      <div className="form-section-title">Document Verification (optional)</div>
      <label className="form-field">
        <span>Select Document</span>
        <select name="verify_doc_id" value={formData.verify_doc_id || ""} onChange={handleChange} disabled={submitting || mode === "create"}>
          <option value="">Select Document</option>
          {documents.map((doc) => (
            <option key={doc.id} value={String(doc.id)}>
              #{doc.id} - {doc.doc_type} ({doc.status})
            </option>
          ))}
        </select>
      </label>
      <label className="form-field">
        <span>Verify Status</span>
        <select name="verify_status" value={formData.verify_status || "verified"} onChange={handleChange} disabled={submitting}>
          <option value="pending">pending</option>
          <option value="verified">verified</option>
          <option value="rejected">rejected</option>
        </select>
      </label>
      {renderField("verify_notes", "Verify Notes")}

      <div className="form-section-title">Onboarding (optional)</div>
      <label className="form-check">
        <input type="checkbox" name="bootstrap_onboarding" checked={Boolean(formData.bootstrap_onboarding)} onChange={handleChange} />
        <span>Create default onboarding checklist</span>
      </label>

      <div className="form-section-title">Role/CTC Change (optional)</div>
      <label className="form-check">
        <input type="checkbox" name="role_change_enabled" checked={Boolean(formData.role_change_enabled)} onChange={handleChange} />
        <span>Add role/CTC history</span>
      </label>
      {renderField("role_name", "Role")}
      {renderField("role_level", "Level")}
      {renderField("role_ctc_amount", "CTC Amount", "number")}
      {renderField("role_start_date", "Role Start Date", "date")}
      {renderField("role_end_date", "Role End Date", "date")}
      {renderField("role_remarks", "Role Remarks")}

      <div className="form-section-title">Exit Workflow Update (optional)</div>
      <label className="form-check">
        <input type="checkbox" name="exit_update_enabled" checked={Boolean(formData.exit_update_enabled)} onChange={handleChange} />
        <span>Update exit workflow for this employee</span>
      </label>
      {renderField("exit_last_working_day", "Last Working Day", "date")}
      <label className="form-field">
        <span>Clearance Status</span>
        <select name="exit_clearance_status" value={formData.exit_clearance_status || "pending"} onChange={handleChange}>
          <option value="pending">pending</option>
          <option value="in_progress">in_progress</option>
          <option value="completed">completed</option>
        </select>
      </label>
      <label className="form-check">
        <input
          type="checkbox"
          name="exit_final_settlement_done"
          checked={Boolean(formData.exit_final_settlement_done)}
          onChange={handleChange}
        />
        <span>Final settlement completed</span>
      </label>
      {renderField("exit_remarks", "Exit Remarks")}
      <button type="submit" disabled={submitting || hasErrors}>
        {submitting ? "Saving..." : mode === "edit" ? "Update Employee" : "Create Employee"}
      </button>
    </form>
  );
};

export default EmployeeForm;
