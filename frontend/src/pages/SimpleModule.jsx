import { useEffect, useState } from "react";
import { Alert, Box, Button, Card, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, Typography, Table, TableHead, TableRow, TableCell, TableBody } from "@mui/material";
import { api } from "../api";
import { useAuthStore } from "../store";
import { displayValue, isInternalIdentifierField, labelForField } from "../localization";
import FilterBar from "../components/FilterBar";

export default function SimpleModule({ title, endpoint, fields = [], filterConfig = [] }) {
  const user = useAuthStore((state) => state.user);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [originalForm, setOriginalForm] = useState(null);
  const [form, setForm] = useState({});
  const [options, setOptions] = useState({});
  const [optionsError, setOptionsError] = useState("");
  const [latestSaving, setLatestSaving] = useState(null);
  const [filters, setFilters] = useState(Object.fromEntries(filterConfig.map((filter) => [filter.name, ""])));
  const [filterOptions, setFilterOptions] = useState({});

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== ""));
      params.pageSize = 100;
      const { data } = await api.get(endpoint, { params });
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      setError(err.response?.status === 404 ? "" : err.response?.data?.error || `No fue posible cargar ${title.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  }

  function openEditVigencia(item) {
    const values = {
      year: String(item.year),
      collectionFrequencyDays: String(item.collectionFrequencyDays),
      startDate: new Date(item.startDate).toISOString().slice(0, 10),
      lastPaymentDate: new Date(item.lastPaymentDate).toISOString().slice(0, 10)
    };
    setError("");
    setEditing(item);
    setForm(values);
    setOriginalForm(values);
    setOpen(true);
  }

  useEffect(() => {
    const timer = window.setTimeout(load, 250);
    return () => window.clearTimeout(timer);
  }, [endpoint, title, JSON.stringify(filters)]);

  useEffect(() => {
    const fieldsWithOptions = fields.filter((field) => field.optionsFrom);
    if (!fieldsWithOptions.length) return;

    Promise.all(fieldsWithOptions.map(async (field) => {
      if (endpoint !== "/prestamos" || field.optionsFrom !== "/socios") {
        const { data } = await api.get(field.optionsFrom, endpoint === "/prestamos" ? { params: { pageSize: 100 } } : undefined);
        return [field.name, data.items || []];
      }
      const members = [];
      let page = 1;
      let total;
      do {
        const { data } = await api.get("/socios", { params: { status: "ACTIVO", page, pageSize: 100 } });
        if (!Array.isArray(data.items) || (data.items.length === 0 && members.length < data.total)) throw new Error("No fue posible obtener todos los socios");
        members.push(...data.items);
        total = data.total;
        page += 1;
      } while (members.length < total);
      return [field.name, members];
    })).then((entries) => { setOptions(Object.fromEntries(entries)); setOptionsError(""); }).catch((err) => {
      setOptionsError(err.response?.data?.error || err.message || "No fue posible cargar las opciones del formulario");
    });
  }, [endpoint]);

  useEffect(() => {
    const dynamicFilters = filterConfig.filter((filter) => filter.optionsFrom);
    Promise.all(dynamicFilters.map(async (filter) => {
      const { data } = await api.get(filter.optionsFrom, { params: { pageSize: 100 } });
      return [filter.name, (data.items || []).map((item) => ({
        value: item.id,
        label: filter.optionLabel ? filter.optionLabel(item) : String(item.year || item.name || "")
      }))];
    })).then((entries) => setFilterOptions(Object.fromEntries(entries))).catch(() => setFilterOptions({}));
  }, [endpoint, JSON.stringify(filterConfig)]);

  useEffect(() => {
    if (endpoint !== "/ahorros" || !open || !form.memberId || !form.vigenciaId) {
      setLatestSaving(null);
      return undefined;
    }

    let active = true;
    setLatestSaving({ status: "loading" });
    api.get("/ahorros", { params: { memberId: form.memberId, vigenciaId: form.vigenciaId, pageSize: 1 } })
      .then(({ data }) => {
        if (!active) return;
        const latest = data.items?.[0];
        setLatestSaving(latest
          ? { status: "found", date: latest.date }
          : { status: "empty" });
      })
      .catch((err) => {
        if (!active) return;
        setLatestSaving({
          status: "error",
          message: err.response?.data?.error || "No fue posible consultar el último ahorro del socio"
        });
      });

    return () => { active = false; };
  }, [endpoint, open, form.memberId, form.vigenciaId]);

  function openCreate() {
    setError("");
    setEditing(null);
    setOriginalForm(null);
    setForm(Object.fromEntries(fields.map((field) => [field.name, field.defaultValue ?? ""])));
    setOpen(true);
  }

  function openEditLoan(item) {
    const days = (new Date(item.interestAnchorAt) - new Date(item.date)) / 86400000;
    const values = {
      type: item.type, vigenciaId: item.vigenciaId, memberId: item.memberId || "",
      borrowerName: item.borrowerName || "", principal: String(item.principal),
      rate: String(item.rate), date: item.date.slice(0, 10),
      interestStartDays: Number.isInteger(days) && days > 0 ? String(days) : "",
      observations: item.observations || ""
    };
    setError("");
    setEditing(item);
    setForm(values);
    setOriginalForm(values);
    setOpen(true);
  }

  const termsLocked = editing && (
    editing.status !== "ACTIVO" || editing.vigencia?.status !== "ABIERTA" ||
    (editing.payments?.length || 0) > 0 || Number(editing.generatedInterest) !== 0 ||
    Number(editing.pendingInterest) !== 0 || Number(editing.balance) !== Number(editing.principal) ||
    new Date(editing.lastInterestAt) > new Date(editing.date)
  );

  function updateField(name, value) {
    if (endpoint === "/ahorros" && name === "vigenciaId") {
      setForm((current) => ({ ...current, vigenciaId: value, memberId: "" }));
      return;
    }
    if (endpoint === "/prestamos" && (name === "type" || name === "vigenciaId")) {
      setForm((current) => ({ ...current, [name]: value, memberId: "" }));
      return;
    }
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editing) {
        const changes = Object.fromEntries(Object.entries(form).filter(([key, value]) =>
          key !== "vigenciaId" && value !== originalForm[key] &&
          (key !== "borrowerName" || form.type === "PARTICULAR")
        ));
        if (!Object.keys(changes).length) { setOpen(false); return; }
        await api.patch(`${endpoint}/${editing.id}`, changes);
      } else {
        await api.post(endpoint, form);
      }
      setOpen(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || `No fue posible guardar ${title.toLowerCase()}`);
    } finally {
      setSaving(false);
    }
  }

  async function remove(item) {
    if (!window.confirm(`Eliminar este registro de ${title.toLowerCase()}?`)) return;
    setError("");
    try {
      await api.delete(`${endpoint}/${item.id}`);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || `No fue posible eliminar ${title.toLowerCase()}`);
    }
  }

  const columns = items.length
    ? (endpoint === "/prestamos"
      ? ["borrowerName", "memberId", "type", "date", "principal", "balance", "generatedInterest", "pendingInterest", "rate", "status"].filter((key) => key in items[0])
      : Object.keys(items[0]).filter((key) => !isInternalIdentifierField(key) && typeof items[0][key] !== "object").slice(0, 6))
    : [];

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h4">{title}</Typography>
        {user?.role === "ADMINISTRADOR" && fields.length > 0 && (
          <Button variant="contained" onClick={openCreate}>Nuevo registro</Button>
        )}
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {filterConfig.length > 0 && (
        <FilterBar
          filters={filterConfig.map((filter) => ({ ...filter, options: filter.options || filterOptions[filter.name] }))}
          value={filters}
          onChange={(name, value) => setFilters((current) => ({ ...current, [name]: value }))}
          onClear={() => setFilters(Object.fromEntries(filterConfig.map((filter) => [filter.name, ""])))}
        />
      )}
      {loading ? <CircularProgress /> : (
        <Card sx={{ overflowX: "auto" }}>
          {items.length ? (
            <Table>
              <TableHead>
                <TableRow>
                  {columns.map((key) => <TableCell key={key}>{endpoint === "/prestamos" && key === "memberId" ? "Socio deudor / avalista" : labelForField(key)}</TableCell>)}
                  {user?.role === "ADMINISTRADOR" && fields.length > 0 && <TableCell>Acciones</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    {columns.map((key) => <TableCell key={key}>{displayValue(key, item[key], item)}</TableCell>)}
                    {user?.role === "ADMINISTRADOR" && fields.length > 0 && (
                      <TableCell>
                        {endpoint === "/prestamos" && <Button size="small" onClick={() => openEditLoan(item)}>Modificar</Button>}
                        {endpoint === "/vigencias" && <Button size="small" onClick={() => openEditVigencia(item)}>Modificar</Button>}
                        <Button size="small" color="error" onClick={() => remove(item)}>Eliminar</Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : <Typography sx={{ p: 3 }} color="text.secondary">No hay registros disponibles.</Typography>}
        </Card>
      )}
      <Dialog open={open} onClose={() => !saving && setOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={save}>
          <DialogTitle>{editing ? `Modificar ${title.toLowerCase().replace(/s$/, "")}` : `Nuevo ${title.toLowerCase().replace(/s$/, "")}`}</DialogTitle>
          <DialogContent sx={{ display: "grid", gap: 2, pt: "16px !important" }}>
            {error && <Alert severity="error">{error}</Alert>}
            {optionsError && <Alert severity="error">{optionsError}</Alert>}
            {termsLocked && <Alert severity="info">Este préstamo tiene pagos, intereses causados o una vigencia cerrada. Sus condiciones no se pueden cambiar; en una vigencia abierta solo puede modificar las observaciones.</Alert>}
            {endpoint === "/prestamos" && form.type === "PARTICULAR" && <Alert severity="info">El saldo pendiente quedará asociado al socio avalista y se tendrá en cuenta en su liquidación.</Alert>}
            {endpoint === "/ahorros" && latestSaving?.status === "loading" && <Alert severity="info">Consultando el último ahorro del socio...</Alert>}
            {endpoint === "/ahorros" && latestSaving?.status === "found" && (
              <Alert severity="info">
                Último ahorro ingresado para este socio en la vigencia seleccionada: <strong>{new Date(latestSaving.date).toLocaleDateString("es-CO")}</strong>.
              </Alert>
            )}
            {endpoint === "/ahorros" && latestSaving?.status === "empty" && (
              <Alert severity="info">El socio seleccionado no tiene ahorros registrados en esta vigencia.</Alert>
            )}
            {endpoint === "/ahorros" && latestSaving?.status === "error" && (
              <Alert severity="error">{latestSaving.message}</Alert>
            )}
            {endpoint === "/vigencias" && (
              <Alert severity="info">Configure la frecuencia de recaudo y el rango de fechas de esta vigencia. El calendario es informativo; los pagos no se generan automáticamente.</Alert>
            )}
            {fields.filter((field) => !field.showFor || form.type === field.showFor).map((field) => (
              <TextField
                key={field.name}
                select={Boolean(field.optionsFrom || field.choices)}
                required={field.required !== false && !(editing && field.name === "interestStartDays" && !originalForm.interestStartDays)}
                disabled={Boolean(editing && (field.name === "vigenciaId" || (termsLocked && field.name !== "observations")))}
                fullWidth
                label={endpoint === "/prestamos" && field.name === "memberId" && form.type === "PARTICULAR" ? "Socio avalista" : field.label}
                type={field.type || "text"}
                helperText={editing && field.name === "interestStartDays" && !originalForm.interestStartDays ? "Préstamo anterior: si no cambia este campo, conserva su calendario original." : field.helperText}
                inputProps={field.readOnly ? { ...field.inputProps, readOnly: true } : field.inputProps}
                InputLabelProps={field.type === "date" ? { shrink: true } : undefined}
                value={form[field.name] ?? ""}
                onChange={(event) => updateField(field.name, event.target.value)}
              >
                {field.optionsFrom && field.required === false && <MenuItem value="">Sin selección</MenuItem>}
                {field.choices?.map((choice) => <MenuItem key={choice.value} value={choice.value}>{choice.label}</MenuItem>)}
                {field.optionsFrom && (options[field.name] || []).filter((item) =>
                  endpoint !== "/prestamos" ||
                  (field.name === "memberId" ? item.vigenciaId === form.vigenciaId : field.name !== "vigenciaId" || item.status === "ABIERTA")
                ).map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {field.optionLabel ? field.optionLabel(item) : item.year || item.name || `${item.firstName || ""} ${item.lastName || ""}`.trim()}
                  </MenuItem>
                ))}
              </TextField>
            ))}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
