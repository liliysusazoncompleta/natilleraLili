import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, Table, TableBody, TableCell, TableHead, TablePagination, TableRow, TextField, Typography
} from "@mui/material";
import { api } from "../api";
import { useAuthStore } from "../store";

const money = (value) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 2 }).format(Number(value));
const columns = [
  ["savings", "Ahorros"], ["activityGain", "Actividades"], ["loanGain", "Intereses de préstamos"],
  ["raffleGain", "Premios y reparto de rifas"], ["adminCommission", "Comisiones administrativas"],
  ["raffleFeesDiscounted", "Cuotas de rifa descontadas"], ["loanDebtDiscounted", "Préstamos descontados"],
  ["outstandingRaffle", "Rifas aún pendientes"], ["outstandingLoan", "Préstamos aún pendientes"],
  ["outstandingActivity", "Actividades pendientes"], ["outstandingSales", "Ventas pendientes"],
  ["finalAmount", "Valor a entregar"]
];

export default function Liquidations() {
  const isAdmin = useAuthStore((state) => state.user?.role === "ADMINISTRADOR");
  const [vigencias, setVigencias] = useState([]);
  const [vigenciaId, setVigenciaId] = useState("");
  const [preview, setPreview] = useState(null);
  const [history, setHistory] = useState({ items: [], total: 0 });
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;
    api.get("/vigencias", { params: { pageSize: 100 } })
      .then(({ data }) => setVigencias(data.items))
      .catch((err) => setError(err.response?.data?.error || "No fue posible consultar las vigencias"));
  }, [isAdmin, refresh]);

  useEffect(() => {
    const params = { page: page + 1, pageSize: 20 };
    if (isAdmin && vigenciaId) params.vigenciaId = vigenciaId;
    api.get("/liquidaciones", { params })
      .then(({ data }) => setHistory(data))
      .catch((err) => setError(err.response?.data?.error || "No fue posible consultar las liquidaciones"));
  }, [isAdmin, vigenciaId, page, refresh]);

  async function loadPreview() {
    setBusy(true);
    setError("");
    setMessage("");
    setPreview(null);
    try {
      const { data } = await api.get(`/liquidaciones/${vigenciaId}/preview`);
      setPreview(data);
    } catch (err) {
      setError(err.response?.data?.error || "No fue posible calcular la vista previa");
    } finally { setBusy(false); }
  }

  async function closeVigencia() {
    setConfirm(false);
    setBusy(true);
    setError("");
    try {
      await api.post(`/liquidaciones/${vigenciaId}`, { fingerprint: preview.fingerprint });
      setPreview(null);
      setMessage("Liquidación registrada y vigencia cerrada.");
      setRefresh((value) => value + 1);
    } catch (err) {
      setPreview(null);
      setError(err.response?.data?.error || "No fue posible confirmar la liquidación. Consulte nuevamente el estado antes de reintentar.");
      setRefresh((value) => value + 1);
    } finally { setBusy(false); }
  }

  const historyColumns = [
    ["savings", "Ahorros"], ["activityGain", "Actividades"], ["loanGain", "Intereses de préstamos"],
    ["raffleGain", "Rifas"], ["adminCommission", "Comisión administrativa"],
    ["raffleFeesDiscounted", "Rifas descontadas"], ["debtsDiscounted", "Descuentos totales"], ["finalAmount", "Valor final"]
  ].filter(([key]) => history.items.some((item) => Object.hasOwn(item, key)));

  return <Box>
    <Typography variant="h4" sx={{ mb: 2 }}>Liquidaciones</Typography>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
    {isAdmin && <>
      <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap", mb: 2 }}>
        <TextField select label="Vigencia" value={vigenciaId} sx={{ minWidth: 180 }} onChange={(event) => {
          setVigenciaId(event.target.value); setPreview(null); setPage(0); setError(""); setMessage("");
        }}>
          {vigencias.map((vigencia) => <MenuItem key={vigencia.id} value={vigencia.id}>{vigencia.year} — {vigencia.status}</MenuItem>)}
        </TextField>
        <Button variant="outlined" disabled={!vigenciaId || busy} onClick={loadPreview}>Calcular vista previa</Button>
        {busy && <CircularProgress size={24} />}
      </Box>
      {preview && <>
        <Alert severity="info" sx={{ mb: 2 }}>
          Esta es una estimación; no se han aplicado descuentos ni cerrado la vigencia. Se actualizan los intereses causados hasta la fecha.
          Los saldos de actividades y ventas no se descuentan automáticamente y permanecen pendientes.
        </Alert>
        {preview.notices.map((notice) => <Alert key={notice} severity="warning" sx={{ mb: 1 }}>{notice}</Alert>)}
        {preview.blockers.map((blocker) => <Alert key={blocker} severity="error" sx={{ mb: 1 }}>{blocker}</Alert>)}
        <Typography variant="h6" sx={{ my: 2 }}>Vista previa de {preview.vigencia.year}</Typography>
        <Card sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow><TableCell>Socio</TableCell>{columns.map(([, label]) => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead>
            <TableBody>{preview.items.map((item) => <TableRow key={item.memberId}>
              <TableCell>{item.member.firstName} {item.member.lastName}</TableCell>
              {columns.map(([key]) => <TableCell key={key}>{money(item[key])}</TableCell>)}
            </TableRow>)}</TableBody>
          </Table>
        </Card>
        <Typography variant="body2" sx={{ mt: 1 }}>La comisión administrativa incluye el 3 % anual de actividades e intereses y las comisiones mensuales de rifas ya distribuidas.</Typography>
        <Button sx={{ my: 2 }} variant="contained" color="error" disabled={busy || preview.blockers.length > 0} onClick={() => setConfirm(true)}>
          Liquidar y cerrar vigencia
        </Button>
      </>}
    </>}
    <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>Liquidaciones registradas</Typography>
    <Card sx={{ overflowX: "auto" }}><Table size="small">
      <TableHead><TableRow><TableCell>Vigencia</TableCell>{isAdmin && <TableCell>Socio</TableCell>}{historyColumns.map(([, label]) => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead>
      <TableBody>{history.items.map((item) => <TableRow key={item.id}>
        <TableCell>{item.vigencia?.year || "—"}</TableCell>
        {isAdmin && <TableCell>{item.member ? `${item.member.firstName} ${item.member.lastName}` : "—"}</TableCell>}
        {historyColumns.map(([key]) => <TableCell key={key}>{Object.hasOwn(item, key) ? money(item[key]) : "—"}</TableCell>)}
      </TableRow>)}
      {!history.items.length && <TableRow><TableCell colSpan={historyColumns.length + (isAdmin ? 2 : 1)}>No hay liquidaciones registradas.</TableCell></TableRow>}
      </TableBody>
    </Table>
      <TablePagination component="div" count={history.total} page={page} rowsPerPage={20} rowsPerPageOptions={[20]} onPageChange={(_, value) => setPage(value)} labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`} />
    </Card>
    <Dialog open={confirm} onClose={() => setConfirm(false)}>
      <DialogTitle>Confirmar liquidación</DialogTitle>
      <DialogContent>Se registrarán los descuentos y se cerrará la vigencia {preview?.vigencia.year}. Esta operación no se puede deshacer desde la aplicación.</DialogContent>
      <DialogActions><Button onClick={() => setConfirm(false)}>Cancelar</Button><Button color="error" onClick={closeVigencia}>Confirmar cierre</Button></DialogActions>
    </Dialog>
  </Box>;
}
