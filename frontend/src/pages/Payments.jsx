import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, MenuItem, Table, TableBody, TableCell, TableHead,
  TableRow, TextField, Typography
} from "@mui/material";
import { api } from "../api";
import { useAuthStore } from "../store";
import FilterBar from "../components/FilterBar";

const money = (value) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 2 }).format(Number(value || 0));
const dateLabel = (value) => value ? new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(new Date(value)) : "—";

export default function Payments() {
  const user = useAuthStore((state) => state.user);
  const [payments, setPayments] = useState([]);
  const [loans, setLoans] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ loanId: "", amount: "", date: new Date().toISOString().slice(0, 10), observations: "" });
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({ search: "", status: "", date: "" });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const paymentParams = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== ""));
      paymentParams.pageSize = 100;
      const requests = [
        api.get("/pagos", { params: paymentParams }),
        api.get("/prestamos?pageSize=100"),
        api.get("/prestamos/resumen")
      ];
      const [paymentsResponse, loansResponse, summaryResponse] = await Promise.all(requests);
      setPayments(paymentsResponse.data.items || []);
      setLoans((loansResponse.data.items || []).filter((loan) => loan.status === "ACTIVO"));
      setSummary(summaryResponse.data);
    } catch (err) {
      setError(err.response?.data?.error || "No fue posible cargar la información de pagos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(load, 250);
    return () => window.clearTimeout(timer);
  }, [JSON.stringify(filters)]);

  function openCreate() {
    setEditing(null);
    setForm({ loanId: "", amount: "", date: new Date().toISOString().slice(0, 10), observations: "" });
    setDialog(true);
  }

  function openEdit(payment) {
    setEditing(payment);
    setForm({
      loanId: payment.loanId,
      amount: String(payment.amount),
      date: new Date(payment.date).toISOString().slice(0, 10),
      observations: payment.observations || ""
    });
    setDialog(true);
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editing) await api.patch(`/pagos/${editing.id}`, { amount: Number(form.amount), date: form.date, observations: form.observations });
      else await api.post("/pagos", { ...form, amount: Number(form.amount) });
      setDialog(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "No fue posible guardar el pago");
    } finally {
      setSaving(false);
    }
  }

  async function annul(payment) {
    const reason = window.prompt("Motivo de anulación del pago:");
    if (reason === null) return;
    setError("");
    try {
      await api.delete(`/pagos/${payment.id}`, { data: { reason } });
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "No fue posible anular el pago");
    }
  }

  const cards = summary ? [
    ["Capital prestado", summary.capitalPrestadoTotal],
    ["Capital recuperado", summary.capitalRecuperado],
    ["Capital pendiente", summary.capitalPendiente],
    ["Intereses generados", summary.interesesGenerados],
    ["Intereses recaudados", summary.interesesRecaudados],
    ["Ganancias distribuibles", summary.gananciasDistribuibles]
  ] : [];

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h4">Pagos de préstamos</Typography>
        {user?.role === "ADMINISTRADOR" && <Button variant="contained" onClick={openCreate}>Nuevo pago</Button>}
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <FilterBar
        filters={[
          { name: "search", label: "Buscar prestatario" },
          { name: "status", label: "Estado", options: [
            { value: "REGISTRADO", label: "Registrado" },
            { value: "ANULADO", label: "Anulado" }
          ] },
          { name: "date", label: "Fecha", type: "date" }
        ]}
        value={filters}
        onChange={(name, value) => setFilters((current) => ({ ...current, [name]: value }))}
        onClear={() => setFilters({ search: "", status: "", date: "" })}
      />
      {summary && <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 2, mb: 3 }}>
        {cards.map(([label, amount]) => <Card key={label}><CardContent>
          <Typography color="text.secondary" variant="body2">{label}</Typography>
          <Typography variant="h6">{money(amount)}</Typography>
        </CardContent></Card>)}
      </Box>}
      {loading ? <CircularProgress /> : <Card sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead><TableRow>
            {["Fecha", "Préstamo", "Prestatario", "Valor abonado", "Aplicado a intereses", "Aplicado a capital", "Saldo anterior", "Nuevo saldo", "Observaciones", "Registrado por", "Estado", ...(user?.role === "ADMINISTRADOR" ? ["Acciones"] : [])].map((label) => <TableCell key={label}>{label}</TableCell>)}
          </TableRow></TableHead>
          <TableBody>{payments.map((payment) => <TableRow key={payment.id} sx={{ opacity: payment.annulledAt ? 0.55 : 1 }}>
            <TableCell>{dateLabel(payment.date)}</TableCell>
            <TableCell>{payment.loan?.borrowerName || "—"}</TableCell>
            <TableCell>{payment.loan?.member ? `${payment.loan.member.firstName} ${payment.loan.member.lastName}` : payment.loan?.borrowerName || "Particular"}</TableCell>
            <TableCell>{money(payment.amount)}</TableCell>
            <TableCell>{money(payment.interest)}</TableCell>
            <TableCell>{money(payment.principal)}</TableCell>
            <TableCell>{money(payment.previousBalance)}</TableCell>
            <TableCell>{money(payment.newBalance)}</TableCell>
            <TableCell>{payment.observations || "—"}</TableCell>
            <TableCell>{payment.recordedByUser ? `${payment.recordedByUser.firstName} ${payment.recordedByUser.lastName}` : "—"}</TableCell>
            <TableCell>{payment.annulledAt ? "ANULADO" : "REGISTRADO"}</TableCell>
            {user?.role === "ADMINISTRADOR" && <TableCell>
              {!payment.annulledAt && <>
                <Button size="small" onClick={() => openEdit(payment)}>Editar</Button>
                <Button size="small" color="error" onClick={() => annul(payment)}>Anular</Button>
              </>}
            </TableCell>}
          </TableRow>)}
          {!payments.length && <TableRow><TableCell colSpan={user?.role === "ADMINISTRADOR" ? 12 : 11} align="center">No hay pagos registrados.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>}
      <Dialog open={dialog} onClose={() => !saving && setDialog(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={save}>
          <DialogTitle>{editing ? "Editar pago" : "Registrar pago"}</DialogTitle>
          <DialogContent sx={{ display: "grid", gap: 2, pt: "16px !important" }}>
            <TextField select label="Préstamo" required disabled={Boolean(editing)} value={form.loanId} onChange={(event) => setForm({ ...form, loanId: event.target.value })}>
              {loans.filter((loan) => loan.id !== editing?.loanId).map((loan) => <MenuItem key={loan.id} value={loan.id}>{loan.borrowerName} — saldo {money(loan.balance)} + intereses {money(loan.pendingInterest)}</MenuItem>)}
              {editing && <MenuItem key={editing.loanId} value={editing.loanId}>{editing.loan?.borrowerName}</MenuItem>}
            </TextField>
            <TextField required type="number" label="Valor abonado" inputProps={{ min: "0.01", step: "0.01" }} value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
            <TextField required type="date" label="Fecha del pago" InputLabelProps={{ shrink: true }} value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
            <TextField label="Observaciones" multiline minRows={2} value={form.observations} onChange={(event) => setForm({ ...form, observations: event.target.value })} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialog(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
