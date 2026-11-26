import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Checkbox, CircularProgress, FormControlLabel, MenuItem,
  Paper, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import { api } from "../api";
import FilterBar from "../components/FilterBar";

const actionLabels = {
  ver: "Ver", consultar: "Consultar", crear: "Crear", editar: "Editar",
  eliminar: "Eliminar", aprobar: "Aprobar", exportar: "Exportar", imprimir: "Imprimir"
};
const moduleLabels = {
  dashboard: "Dashboard", perfil: "Mi perfil", socios: "Socios", usuarios: "Usuarios",
  ahorros: "Ahorros", prestamos: "Préstamos", pagos: "Pagos", actividades: "Actividades",
  rifas: "Rifas", deudas: "Deudas", liquidaciones: "Liquidaciones",
  vigencias: "Vigencias", reportes: "Reportes", configuracion: "Configuración"
};
const fieldLabels = {
  totalAhorrado: "Total ahorrado", totalPrestado: "Total prestado", carteraPendiente: "Saldo pendiente",
  deudasPendientes: "Deudas pendientes", sociosActivos: "Socios activos",
  gananciasActividades: "Ganancias de actividades", gananciasPrestamos: "Ganancias de préstamos",
  gananciasRifas: "Ganancias de rifas", comisionAdministrativa: "Comisión administrativa",
  valorTotalEntregar: "Valor a entregar", numeroRifa: "Número de rifa",
  gananciasPropias: "Mis ganancias", valorProyectadoLiquidacion: "Liquidación proyectada",
  rifasPendientes: "Estado de cuotas y participación en rifas",
  document: "Documento", phone: "Teléfono", address: "Dirección", email: "Correo",
  raffleNumber: "Número de rifa", status: "Estado", role: "Rol", date: "Fecha",
  amount: "Valor", observation: "Observación", borrowerName: "Prestatario", type: "Tipo",
  principal: "Capital", balance: "Saldo", rate: "Tasa", name: "Nombre",
  description: "Descripción", gain: "Ganancia", winningNumber: "Número ganador",
  prize: "Premio", concept: "Concepto", dueDate: "Vencimiento",
  savings: "Ahorros", activityGain: "Ganancias de actividades",
  loanGain: "Ganancias de préstamos", raffleGain: "Ganancias de rifas",
  raffleFeesDiscounted: "Cuotas de rifas descontadas",
  finalAmount: "Valor final"
};

export default function Permissions() {
  const [data, setData] = useState(null);
  const [role, setRole] = useState("SOCIO");
  const [copyFrom, setCopyFrom] = useState("ADMINISTRADOR");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [auditItems, setAuditItems] = useState([]);
  const [auditFilters, setAuditFilters] = useState({ search: "" });

  async function load() {
    try {
      const response = await api.get("/permisos");
      setData(response.data);
      const auditResponse = await api.get("/auditoria/permisos");
      setAuditItems(auditResponse.data.items || []);
      setError("");
    } catch (err) { setError(err.response?.data?.error || "No fue posible cargar los permisos"); }
  }

  useEffect(() => { load(); }, []);

  function setAction(module, action, checked) {
    setData((current) => ({
      ...current,
      roles: { ...current.roles, [role]: { ...current.roles[role], modules: {
        ...current.roles[role].modules, [module]: { ...current.roles[role].modules[module], [action]: checked }
      } } }
    }));
    setSaved(false);
  }

  function setField(module, field, checked) {
    setData((current) => ({
      ...current,
      roles: { ...current.roles, [role]: { ...current.roles[role], fields: {
        ...current.roles[role].fields, [module]: { ...current.roles[role].fields[module], [field]: checked }
      } } }
    }));
    setSaved(false);
  }

  function copyRolePermissions() {
    if (!data || copyFrom === role) return;
    setData((current) => ({ ...current, roles: { ...current.roles, [role]: structuredClone(current.roles[copyFrom]) } }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const permissions = data.roles[role];
      await api.put(`/permisos/${role}`, { modules: permissions.modules, fields: permissions.fields });
      setSaved(true);
    } catch (err) {
      setError(err.response?.data?.error || "No fue posible guardar los permisos");
    } finally { setSaving(false); }
  }

  if (!data && !error) return <CircularProgress />;

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>Roles y permisos</Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>Configure módulos, acciones y visibilidad de campos. La API valida cada permiso independientemente de la interfaz.</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {saved && <Alert severity="success" sx={{ mb: 2 }}>Permisos guardados y cambio registrado en auditoría.</Alert>}
      {data && <>
        <TextField select label="Rol" value={role} onChange={(e) => { setRole(e.target.value); setSaved(false); }} sx={{ mb: 2, minWidth: 240 }}>
          <MenuItem value="ADMINISTRADOR">Administrador</MenuItem><MenuItem value="SOCIO">Socio</MenuItem>
        </TextField>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 2, flexWrap: "wrap" }}>
          <TextField select size="small" label="Copiar permisos de" value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} sx={{ minWidth: 220 }}>
            <MenuItem value="ADMINISTRADOR">Administrador</MenuItem><MenuItem value="SOCIO">Socio</MenuItem>
          </TextField>
          <Button variant="outlined" disabled={copyFrom === role} onClick={copyRolePermissions}>Copiar permisos</Button>
        </Box>
        <Paper sx={{ overflowX: "auto", mb: 3 }}>
          <Table size="small">
            <TableHead><TableRow><TableCell>Módulo</TableCell>{data.actions.map((action) => <TableCell key={action}>{actionLabels[action] || action}</TableCell>)}</TableRow></TableHead>
            <TableBody>{data.modules.map((module) => <TableRow key={module}>
              <TableCell>{moduleLabels[module] || module}</TableCell>
              {data.actions.map((action) => <TableCell key={action}><Checkbox checked={Boolean(data.roles[role].modules[module]?.[action])} onChange={(e) => setAction(module, action, e.target.checked)} /></TableCell>)}
            </TableRow>)}</TableBody>
          </Table>
        </Paper>
        <Typography variant="h5" sx={{ mb: 1 }}>Visibilidad de campos</Typography>
        {Object.entries(data.fields).map(([module, fields]) => (
          <Paper key={module} sx={{ p: 2, mb: 2 }}>
            <Typography fontWeight={700}>{moduleLabels[module] || module}</Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap" }}>
              {fields.map((field) => <FormControlLabel key={field} control={<Checkbox checked={Boolean(data.roles[role].fields[module]?.[field])} onChange={(e) => setField(module, field, e.target.checked)} />} label={fieldLabels[field] || field} />)}
            </Box>
          </Paper>
        ))}
        <Button variant="contained" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar permisos"}</Button>
        <Typography variant="h5" sx={{ mt: 4, mb: 1 }}>Auditoría de cambios de permisos</Typography>
        <FilterBar
          filters={[{ name: "search", label: "Buscar rol, módulo o campo" }]}
          value={auditFilters}
          onChange={(name, value) => setAuditFilters((current) => ({ ...current, [name]: value }))}
          onClear={() => setAuditFilters({ search: "" })}
        />
        <Paper sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow><TableCell>Fecha</TableCell><TableCell>Administrador</TableCell><TableCell>Rol afectado</TableCell><TableCell>Detalle</TableCell></TableRow></TableHead>
            <TableBody>{auditItems.filter((item) => {
              if (!auditFilters.search) return true;
              const haystack = `${item.metadata?.role || ""} ${item.metadata?.module || ""} ${item.metadata?.field || ""} ${item.metadata?.action || ""}`.toLocaleLowerCase("es");
              return haystack.includes(auditFilters.search.toLocaleLowerCase("es"));
            }).map((item) => <TableRow key={item.id}>
              <TableCell>{new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))}</TableCell>
              <TableCell>{item.user?.username || item.user?.email || "—"}</TableCell>
              <TableCell>{item.metadata?.role || "—"}</TableCell>
              <TableCell>{item.metadata?.module || item.metadata?.field}: {item.metadata?.action || item.metadata?.field} ({String(item.metadata?.previous)} → {String(item.metadata?.next)})</TableCell>
            </TableRow>)}</TableBody>
          </Table>
          {!auditItems.length && <Typography sx={{ p: 2 }} color="text.secondary">No hay cambios de permisos registrados.</Typography>}
        </Paper>
      </>}
    </Box>
  );
}
