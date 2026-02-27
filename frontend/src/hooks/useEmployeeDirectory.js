import { useMemo, useState } from "react";

function compareText(a, b) {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

export function useEmployeeDirectory(employees) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");

  const visibleEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    let items = [...employees];

    if (q) {
      items = items.filter((emp) => {
        const name = String(emp.name || "").toLowerCase();
        const empId = String(emp.emp_id || "").toLowerCase();
        return name.includes(q) || empId.includes(q);
      });
    }

    if (status !== "all") {
      const active = status === "active";
      items = items.filter((emp) => Boolean(emp.is_active) === active);
    }

    items.sort((a, b) => {
      let result = 0;
      if (sortBy === "joining_date") {
        const da = new Date(a.joining_date || "1900-01-01").getTime();
        const db = new Date(b.joining_date || "1900-01-01").getTime();
        result = da - db;
      } else {
        result = compareText(String(a.name || ""), String(b.name || ""));
      }
      return sortOrder === "asc" ? result : -result;
    });

    return items;
  }, [employees, search, status, sortBy, sortOrder]);

  return {
    search,
    setSearch,
    status,
    setStatus,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    visibleEmployees,
  };
}
