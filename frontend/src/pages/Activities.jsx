import { useEffect, useMemo, useState } from "react";
import {
  Alert, Autocomplete, Box, Button, Card, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, MenuItem, Table, TableBody, TableCell, TableHead,
  TableRow, TextField, Typography
} from "@mui/material";
import { api } from "../api";
import { useAuthStore } from "../store";
import FilterBar from "../components/FilterBar";
import ActivitySales from "../components/ActivitySales";

const currency = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 2 });
const displayName = (member) => [member?.firstName, member?.lastName].filter(Boolean).join(" ") || "—";
const emptyActivity = () => ({
  name: "", description: "", date: new Date().toISOString().slice(0, 10),
  income: "0", costs: "0", participantCost: "0", vigenciaId: ""
});

export default function Activities() {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === "ADMINISTRADOR";
  const [items, setItems] = useState([]);
  const [vigencias, setVigencias] = useState([]);
  const [members, setMembers] = useState([]);
  const [filters, setFilters] = useState({ search: "", vigenciaId: "", date: "" });
  const [form, setForm] = useState(emptyActivity);
  const [selectedActivityId, setSelectedActivityId] = useState("");
  const [participantIds, setParticipantIds] = useState([]);
  const [paymentTarget, setPaymentTarget] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ amount: "", observations: "" });
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [participantsDialogOpen, setParticipantsDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [salesActivity, setSalesActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedActivity = items.find((item) => item.id === selectedActivityId) || null;
  const selectedParticipants = useMemo(
    () => selectedActivity?.participants || [],
    [selectedActivity]
  );
  const currentTarget = selectedParticipants.find((item) => item.memberId === paymentTarget?.memberId) || paymentTarget;
  const canRegisterPayment = isAdmin && Number(currentTarget?.balance) > 0;
  const vigenciaOptions = useMemo(() => vigencias.map((item) => ({
    value: item.id,
    label: String(item.year)
  })), [vigencias]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
      params.pageSize = 100;
      const { data } = await api.get("/actividades", { params });
      setItems(data.items || []);
    } catch (err) {
      setError(err.response?.data?.error || "No fue posible cargar las actividades");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(load, 250);
    return () => window.clearTimeout(timer);
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    if (!isAdmin) return;
    api.get("/vigencias", { params: { pageSize: 100 } })
      .then(({ data }) => {
        const options = data.items || [];
        setVigencias(options);
        const openVigenciaId = options.find((item) => item.status === "ABIERTA")?.id || "";
        setForm((current) => ({ ...current, vigenciaId: current.vigenciaId || openVigenciaId }));
      })
      .catch((err) => setError(err.response?.data?.error || "No fue posible cargar las vigencias"));
  }, [isAdmin]);

  function openCreate() {
    setForm({
      ...emptyActivity(),
      vigenciaId: vigencias.find((item) => item.status === "ABIERTA")?.id || ""
    });
    setSelectedActivityId("");
    setActivityDialogOpen(true);
    setError("");
  }

  function openEdit(activity) {
    setForm({
      name: activity.name || "",
      description: activity.description || "",
      date: activity.date ? new Date(activity.date).toISOString().slice(0, 10) : "",
      income: String(activity.income ?? 0),
      costs: String(activity.costs ?? 0),
      participantCost: String(activity.participantCost ?? 0),
      vigenciaId: activity.vigenciaId
    });
    setSelectedActivityId(activity.id);
    setActivityDialogOpen(true);
    setError("");
  }

  async function saveActivity(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        ...form,
        income: Number(form.income),
        costs: Number(form.costs),
        participantCost: Number(form.participantCost)
      };
      if (selectedActivityId) {
        delete payload.vigenciaId;
        await api.patch(`/actividades/${selectedActivityId}`, payload);
        setNotice("Actividad modificada correctamente.");
      } else {
        await api.post("/actividades", payload);
        setNotice("Actividad registrada correctamente.");
      }
      setActivityDialogOpen(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "No fue posible guardar la actividad");
    } finally {
      setSaving(false);
    }
  }

  async function openParticipants(activity) {
    setSaving(true);
    setError("");
    try {
      const membersInVigencia = [];
      let page = 1;
      let total = 0;
      do {
        const { data } = await api.get("/socios", {
          params: { vigenciaId: activity.vigenciaId, status: "ACTIVO", page, pageSize: 100 }
        });
        membersInVigencia.push(...(data.items || []));
        total = data.total || 0;
        page += 1;
      } while (membersInVigencia.length < total);
      setMembers(membersInVigencia);
      setSelectedActivityId(activity.id);
      setParticipantIds(activity.participants.map((participant) => participant.memberId));
      setParticipantsDialogOpen(true);
    } catch (err) {
      setError(err.response?.data?.error || "No fue posible cargar los socios de la vigencia");
    } finally {
      setSaving(false);
    }
  }

  async function saveParticipants(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api.put(`/actividades/${selectedActivityId}/participantes`, { memberIds: participantIds });
      setNotice("Participantes de la actividad actualizados.");
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "No fue posible actualizar los participantes");
    } finally {
      setSaving(false);
    }
  }

  function openPayment(participant) {
    setPaymentTarget(participant);
    setPaymentForm({ amount: "", observations: "" });
    setPaymentDialogOpen(true);
  }

  async function savePayment(event) {
    event.preventDefault();
    if (!selectedActivity || !paymentTarget) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api.post(
        `/actividades/${selectedActivity.id}/participantes/${paymentTarget.memberId}/abonos`,
        { amount: Number(paymentForm.amount), observations: paymentForm.observations }
      );
      setPaymentDialogOpen(false);
      setNotice(`Abono registrado para ${displayName(paymentTarget.member)}.`);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "No fue posible registrar el abono");
    } finally {
      setSaving(false);
    }
  }

  async function removeActivity(activity) {
    if (!window.confirm(`¿Eliminar la actividad "${activity.name}"?`)) return;
    setError("");
    try {
      await api.delete(`/actividades/${activity.id}`);
      setNotice("Actividad eliminada.");
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "No fue posible eliminar la actividad");
    }
  }

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, gap: 2 }}>
        <Typography variant="h4">Actividades</Typography>
        {isAdmin && <Button variant="contained" onClick={openCreate}>Registrar actividad</Button>}
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert>}
      <FilterBar
        filters={[
          { name: "search", label: "Buscar actividad" },
          ...(isAdmin ? [{ name: "vigenciaId", label: "Vigencia", options: vigenciaOptions }] : []),
          { name: "date", label: "Fecha", type: "date" }
        ]}
        value={filters}
        onChange={(name, value) => setFilters((current) => ({ ...current, [name]: value }))}
        onClear={() => setFilters({ search: "", vigenciaId: "", date: "" })}
      />

      {loading ? <CircularProgress /> : (
        <Card sx={{ overflowX: "auto" }}>
          {items.length ? (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Nombre</TableCell>
                  <TableCell>Descripción</TableCell>
                  <TableCell>Fecha</TableCell>
                  <TableCell>Otros ingresos</TableCell>
                  <TableCell>Otros costos</TableCell>
                  <TableCell>Valor por participante</TableCell>
                  <TableCell>Participantes</TableCell>
                  <TableCell>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((activity) => (
                  <TableRow key={activity.id}>
                    <TableCell>{activity.name}</TableCell>
                    <TableCell>{activity.description || "—"}</TableCell>
                    <TableCell>{new Date(activity.date).toLocaleDateString("es-CO")}</TableCell>
                    <TableCell>{activity.income !== undefined ? currency.format(Number(activity.income)) : "—"}</TableCell>
                    <TableCell>{activity.costs !== undefined ? currency.format(Number(activity.costs)) : "—"}</TableCell>
                    <TableCell>{activity.participantCost !== undefined ? currency.format(Number(activity.participantCost)) : "—"}</TableCell>
                    <TableCell>{activity.participants?.length ?? 0}</TableCell>
                    <TableCell sx={{ minWidth: 250 }}>
                      <Button size="small" onClick={() => openParticipants(activity)}>
                        {isAdmin ? "Registrar participantes" : "Ver participantes"}
                      </Button>
                      <Button size="small" onClick={() => setSalesActivity(activity)}>Ventas</Button>
                      {isAdmin && (
                        <>
                          <Button size="small" onClick={() => openEdit(activity)}>Modificar</Button>
                          <Button size="small" color="error" onClick={() => removeActivity(activity)}>Eliminar</Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : <Typography sx={{ p: 3 }} color="text.secondary">No hay actividades disponibles.</Typography>}
        </Card>
      )}

      <Dialog open={activityDialogOpen} onClose={() => !saving && setActivityDialogOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={saveActivity}>
          <DialogTitle>{selectedActivityId ? "Modificar actividad" : "Registrar actividad"}</DialogTitle>
          <DialogContent sx={{ display: "grid", gap: 2, pt: "16px !important" }}>
            <TextField required label="Nombre" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            <TextField label="Descripción" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
            <TextField required type="date" label="Fecha" value={form.date} InputLabelProps={{ shrink: true }} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} />
            <TextField required type="number" label="Otros ingresos (sin ventas)" inputProps={{ min: 0, step: "0.01" }} value={form.income} onChange={(event) => setForm((current) => ({ ...current, income: event.target.value }))} />
            <TextField required type="number" label="Otros costos (sin productos vendidos)" inputProps={{ min: 0, step: "0.01" }} value={form.costs} onChange={(event) => setForm((current) => ({ ...current, costs: event.target.value }))} />
            <TextField required type="number" label="Valor que debe pagar cada participante" inputProps={{ min: 0, step: "0.01" }} value={form.participantCost} onChange={(event) => setForm((current) => ({ ...current, participantCost: event.target.value }))} />
            {!selectedActivityId && (
              <TextField
                required select label="Vigencia" value={form.vigenciaId}
                onChange={(event) => setForm((current) => ({ ...current, vigenciaId: event.target.value }))}
              >
                {vigencias.filter((item) => item.status === "ABIERTA").map((item) => (
                  <MenuItem key={item.id} value={item.id}>{item.year}</MenuItem>
                ))}
              </TextField>
            )}
            <Typography variant="caption" color="text.secondary">
              Las ganancias netas se asignarán únicamente a los participantes registrados, según su proporción de ahorro en esta vigencia. La deuda individual se controla aparte y no impide recibir ganancias.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setActivityDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={participantsDialogOpen} onClose={() => !saving && setParticipantsDialogOpen(false)} fullWidth maxWidth="lg">
        <DialogTitle>Participantes: {selectedActivity?.name}</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 2, pt: "16px !important" }}>
          {isAdmin && (
            <Box component="form" onSubmit={saveParticipants} sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
              <Autocomplete
                multiple
                options={members}
                value={members.filter((member) => participantIds.includes(member.id))}
                onChange={(_event, selected) => setParticipantIds(selected.map((member) => member.id))}
                getOptionLabel={displayName}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => <TextField {...params} label="Socios que participaron" placeholder="Seleccionar socios" />}
                sx={{ flex: 1 }}
              />
              <Button type="submit" variant="contained" disabled={saving}>Guardar participantes</Button>
            </Box>
          )}
          {selectedParticipants.length ? (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Socio</TableCell>
                  <TableCell>Ganancia asignada</TableCell>
                  <TableCell>Valor a pagar</TableCell>
                  <TableCell>Abonado</TableCell>
                  <TableCell>Saldo</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {selectedParticipants.map((participant) => (
                  <TableRow key={participant.memberId}>
                    <TableCell>{displayName(participant.member)}</TableCell>
                    <TableCell>{currency.format(Number(participant.gain))}</TableCell>
                    <TableCell>{currency.format(Number(participant.amountDue))}</TableCell>
                    <TableCell>{currency.format(Number(participant.amountPaid))}</TableCell>
                    <TableCell>{currency.format(Number(participant.balance))}</TableCell>
                    <TableCell>{participant.paymentStatus}</TableCell>
                    <TableCell>
                        {isAdmin && participant.balance > 0 && (
                          <Button size="small" onClick={() => openPayment(participant)}>Registrar abono</Button>
                        )}
                        <Button size="small" onClick={() => openPayment(participant)}>
                          Ver abonos ({participant.payments?.length || 0})
                        </Button>
                      </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Alert severity="info">
              {isAdmin ? "Agrega los socios que participaron y guarda la lista para calcular sus ganancias." : "Aún no estás registrado como participante de esta actividad."}
            </Alert>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setParticipantsDialogOpen(false)}>Cerrar</Button></DialogActions>
      </Dialog>

      <Dialog open={paymentDialogOpen} onClose={() => !saving && setPaymentDialogOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={savePayment}>
          <DialogTitle>
            {canRegisterPayment ? "Registrar abono de" : "Abonos de"} {displayName(currentTarget?.member)}
          </DialogTitle>
          <DialogContent sx={{ display: "grid", gap: 2, pt: "16px !important" }}>
            <Alert severity="info">
              Valor a pagar: {currency.format(Number(currentTarget?.amountDue || 0))} · Abonado: {currency.format(Number(currentTarget?.amountPaid || 0))} · Saldo pendiente: {currency.format(Number(currentTarget?.balance || 0))}.
            </Alert>
            {canRegisterPayment && (
              <>
                <TextField
                  required type="number" label="Valor del abono"
                  inputProps={{ min: 0.01, max: currentTarget?.balance, step: "0.01" }}
                  value={paymentForm.amount}
                  onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))}
                />
                <TextField
                  label="Observaciones" value={paymentForm.observations}
                  onChange={(event) => setPaymentForm((current) => ({ ...current, observations: event.target.value }))}
                />
              </>
            )}
            <Typography variant="subtitle2">Historial de abonos y observaciones</Typography>
            {currentTarget?.payments?.length ? (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Fecha</TableCell>
                    <TableCell>Valor</TableCell>
                    <TableCell>Observaciones</TableCell>
                    <TableCell>Registró</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {currentTarget.payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{new Date(payment.paidAt).toLocaleDateString("es-CO")}</TableCell>
                      <TableCell>{currency.format(Number(payment.amount))}</TableCell>
                      <TableCell>{payment.observations || "—"}</TableCell>
                      <TableCell>{displayName(payment.recordedBy)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Typography variant="body2" color="text.secondary">Aún no hay abonos registrados.</Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPaymentDialogOpen(false)} disabled={saving}>{canRegisterPayment ? "Cancelar" : "Cerrar"}</Button>
            {canRegisterPayment && (
              <Button type="submit" variant="contained" disabled={saving}>{saving ? "Guardando..." : "Registrar abono"}</Button>
            )}
          </DialogActions>
        </Box>
      </Dialog>
      {salesActivity && <ActivitySales activity={salesActivity} isAdmin={isAdmin} onClose={() => setSalesActivity(null)} onChanged={load} />}
    </Box>
  );
}
