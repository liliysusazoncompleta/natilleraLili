import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import { api } from "../api";
import { useAuthStore } from "../store";
import FilterBar from "../components/FilterBar";

const currency = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 2 });
const displayName = (person) => [person?.firstName, person?.lastName].filter(Boolean).join(" ") || "—";
const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function initialDrawDates() {
  return Array.from({ length: 12 }, (_, month) => ({ month: month + 1, date: "" }));
}

function toBogotaISOString(value) {
  if (!value) return null;
  const date = new Date(`${value}:00-05:00`);
  if (!Number.isFinite(date.getTime())) throw new RangeError("Ingrese una fecha y hora válida");
  return date.toISOString();
}

function toBogotaInput(value) {
  return new Date(value).toLocaleString("sv-SE", { timeZone: "America/Bogota" }).replace(" ", "T").slice(0, 16);
}

export default function Raffles() {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === "ADMINISTRADOR";
  const [items, setItems] = useState([]);
  const [vigencias, setVigencias] = useState([]);
  const [filters, setFilters] = useState({ vigenciaId: "" });
  const [selectedMonthId, setSelectedMonthId] = useState("");
  const [drawDates, setDrawDates] = useState(initialDrawDates);
  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [winningNumber, setWinningNumber] = useState("");
  const [drawDate, setDrawDate] = useState("");
  const [paymentEntry, setPaymentEntry] = useState(null);
  const [paymentDate, setPaymentDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [setupOpen, setSetupOpen] = useState(false);
  const [drawOpen, setDrawOpen] = useState(false);
  const [editDrawDateOpen, setEditDrawDateOpen] = useState(false);

  const paymentDateIsEdit = Boolean(paymentEntry?.paidAt);
  const selectedMonth = items.find((item) => item.id === selectedMonthId) || null;
  const availableMonths = useMemo(
    () => items.filter((item) => !filters.vigenciaId || item.vigenciaId === filters.vigenciaId),
    [items, filters.vigenciaId]
  );
  const selectedVigenciaId = filters.vigenciaId || vigencias.find((item) => item.status === "ABIERTA")?.id || "";
  const selectedVigencia = vigencias.find((item) => item.id === selectedVigenciaId);
  const configuredProgram = items.some((item) => item.vigenciaId === selectedVigenciaId);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = filters.vigenciaId ? { vigenciaId: filters.vigenciaId } : {};
      const { data } = await api.get("/rifas-mensuales", { params });
      setItems(data.items || []);
    } catch (err) {
      setError(err.response?.data?.error || "No fue posible cargar el calendario de rifas");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [filters.vigenciaId]);

  useEffect(() => {
    if (!isAdmin) return;
    api.get("/vigencias", { params: { pageSize: 100 } })
      .then(({ data }) => {
        const options = data.items || [];
        setVigencias(options);
        setFilters((current) => current.vigenciaId
          ? current
          : { ...current, vigenciaId: options.find((item) => item.status === "ABIERTA")?.id || options[0]?.id || "" });
      })
      .catch((err) => setError(err.response?.data?.error || "No fue posible cargar las vigencias"));
  }, [isAdmin]);

  useEffect(() => {
    if (!availableMonths.length) {
      setSelectedMonthId("");
    } else if (!availableMonths.some((item) => item.id === selectedMonthId)) {
      setSelectedMonthId(availableMonths[0].id);
    }
  }, [availableMonths, selectedMonthId]);

  function openSetup() {
    const configuredMonths = items.filter((item) => item.vigenciaId === selectedVigenciaId);
    setMonthlyAmount(configuredMonths.length ? String(configuredMonths[0].programMonthlyAmount) : "");
    setDrawDates(initialDrawDates().map((entry) => {
      const month = configuredMonths.find((item) => item.month === entry.month);
      return month ? { ...entry, date: toBogotaInput(month.drawAt), finalizedAt: month.finalizedAt } : entry;
    }));
    setSetupOpen(true);
    setError("");
  }

  async function saveSetup(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        vigenciaId: selectedVigenciaId,
        monthlyAmount,
        drawDates: drawDates.map((item) => {
          const existing = availableMonths.find((month) => month.month === item.month);
          return existing && item.date === toBogotaInput(existing.drawAt)
            ? existing.drawAt
            : toBogotaISOString(item.date);
        })
      };
      const { data } = configuredProgram
        ? await api.patch("/rifas-mensuales/configuracion", payload)
        : await api.post("/rifas-mensuales/configuracion", payload);
      setSetupOpen(false);
      setNotice(configuredProgram
        ? `Configuración actualizada. Sorteos nuevos: ${data.added}; fechas modificadas: ${data.changed}. Las cuotas existentes conservan su valor.`
        : `Configuración creada: ${currency.format(Number(data.monthlyAmount))} por socio. Se programaron ${data.months.length} sorteos y se generaron sus cuotas.`);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "No fue posible configurar las rifas");
    } finally {
      setSaving(false);
    }
  }

  function openPaymentDate(entry) {
    setPaymentEntry(entry);
    setPaymentDate(entry.paidAt ? toBogotaInput(entry.paidAt) : toBogotaInput(new Date()));
    setError("");
  }

  async function savePayment(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const paidAt = toBogotaISOString(paymentDate);
      if (paymentDateIsEdit) {
        await api.patch(`/rifas-mensuales/${selectedMonth.id}/pagos/${paymentEntry.memberId}/fecha`, { paidAt });
        setNotice(`Fecha de pago de ${displayName(paymentEntry.member)} actualizada.`);
      } else {
        await api.post(`/rifas-mensuales/${selectedMonth.id}/pagos/${paymentEntry.memberId}`, { paidAt });
        setNotice(`Pago de ${displayName(paymentEntry.member)} registrado por ${currency.format(Number(paymentEntry.amount))}.`);
      }
      setPaymentEntry(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "No fue posible guardar la fecha de pago");
    } finally {
      setSaving(false);
    }
  }

  async function annulPayment(entry) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api.patch(`/rifas-mensuales/${selectedMonth.id}/pagos/${entry.memberId}/anular`);
      setNotice(`Pago de ${displayName(entry.member)} anulado. La cuota volvió a quedar pendiente.`);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "No fue posible anular el pago");
    } finally {
      setSaving(false);
    }
  }

  async function closeDraw(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { data } = await api.post(`/rifas-mensuales/${selectedMonth.id}/sortear`, {
        winningNumber: winningNumber.trim() || null
      });
      setDrawOpen(false);
      setNotice(data.winner
        ? `Sorteo cerrado. Ganador: ${displayName(data.winner)}. Premio asignado: ${currency.format(Number(data.prize))}.`
        : "Sorteo cerrado sin ganador; se asignó el 3 % a los administradores y el resto a quienes pagaron a tiempo.");
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "No fue posible cerrar el sorteo");
    } finally {
      setSaving(false);
    }
  }

  async function updateDrawDate(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api.patch(`/rifas-mensuales/${selectedMonth.id}/fecha`, {
        drawAt: toBogotaISOString(drawDate)
      });
      setDrawDate("");
      setNotice("Fecha del sorteo actualizada.");
      await load();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "No fue posible modificar la fecha del sorteo");
    } finally {
      setSaving(false);
    }
  }

  const canCloseDraw = selectedMonth && !selectedMonth.finalizedAt && new Date() >= new Date(selectedMonth.drawAt);
  const ownEntry = selectedMonth?.entries?.[0];

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, gap: 2, flexWrap: "wrap" }}>
        <Typography variant="h4">Rifas mensuales</Typography>
        {isAdmin && selectedVigencia?.status === "ABIERTA" && (
          <Button variant="contained" onClick={openSetup}>Configurar valor y calendario</Button>
        )}
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert>}
      <FilterBar
        filters={isAdmin ? [{
          name: "vigenciaId",
          label: "Vigencia",
          options: vigencias.map((item) => ({ value: item.id, label: String(item.year) }))
        }] : []}
        value={filters}
        onChange={(name, value) => setFilters((current) => ({ ...current, [name]: value }))}
        onClear={() => setFilters({ vigenciaId: "" })}
      />

      {loading ? <CircularProgress /> : !items.length ? (
        <Card sx={{ p: 3 }}>
          <Typography color="text.secondary">
            {isAdmin
              ? "Esta vigencia aún no tiene rifas mensuales configuradas."
              : "Todavía no hay un calendario de rifas para consultar."}
          </Typography>
        </Card>
      ) : (
        <>
          <TextField
            select label="Mes del sorteo" value={selectedMonthId}
            onChange={(event) => setSelectedMonthId(event.target.value)}
            sx={{ minWidth: 300, mb: 2 }}
          >
            {availableMonths.map((item) => (
              <MenuItem key={item.id} value={item.id}>
                {monthNames[item.month - 1]} · {item.vigencia.year} · {new Date(item.drawAt).toLocaleString("es-CO")}
              </MenuItem>
            ))}
          </TextField>

          {isAdmin && selectedMonth && (
            <Card sx={{ p: 2, mb: 2, display: "flex", gap: 3, flexWrap: "wrap" }}>
              <Typography>Vigencia: <strong>{selectedMonth.vigencia.year}</strong></Typography>
              <Typography>Valor mensual por socio: <strong>{selectedMonth.monthlyAmount != null && Number.isFinite(Number(selectedMonth.monthlyAmount)) ? currency.format(Number(selectedMonth.monthlyAmount)) : "No disponible"}</strong></Typography>
              <Typography>Fecha y hora del sorteo: <strong>{new Date(selectedMonth.drawAt).toLocaleString("es-CO")}</strong></Typography>
              <Typography>Recaudado a tiempo{!selectedMonth.finalizedAt ? " (actual)" : ""}: <strong>{currency.format(Number(selectedMonth.finalizedAt ? selectedMonth.collectedAmount : selectedMonth.projection.collectedAmount))}</strong></Typography>
              <Typography>Estado: <strong>{selectedMonth.finalizedAt ? "Sorteo cerrado" : "Sorteo abierto"}</strong></Typography>
              {!selectedMonth.finalizedAt && (
                <Button
                  variant="outlined"
                  onClick={() => {
                    setDrawDate(new Date(selectedMonth.drawAt).toLocaleString("sv-SE", { timeZone: "America/Bogota" }).replace(" ", "T").slice(0, 16));
                    setError("");
                    setEditDrawDateOpen(true);
                  }}
                >
                  Modificar fecha
                </Button>
              )}
              {selectedMonth.finalizedAt && (
                <Typography>
                  Resultado: <strong>{selectedMonth.winner
                    ? `${displayName(selectedMonth.winner)}${selectedMonth.winner.raffleNumber ? ` · Número ${selectedMonth.winner.raffleNumber}` : ""} · Premio ${currency.format(Number(selectedMonth.prize))}`
                    : "Sorteo cerrado sin ganador"}</strong>
                </Typography>
              )}
              {canCloseDraw && <Button variant="contained" onClick={() => { setWinningNumber(""); setDrawOpen(true); }}>Cerrar sorteo</Button>}
            </Card>
          )}

          {isAdmin && selectedMonth && (
            <Card sx={{ p: 2, mb: 2, display: "grid", gap: 1 }}>
              <Typography variant="h6">{selectedMonth.finalizedAt ? "Distribución registrada" : "Distribución estimada con los pagos actuales"}</Typography>
              {!selectedMonth.finalizedAt ? (
                <>
                  <Typography>Si hay ganador: administradores (3 %): <strong>{currency.format(Number(selectedMonth.projection.adminCommission))}</strong> · Ganador: <strong>{currency.format(Number(selectedMonth.projection.winnerAmount))}</strong></Typography>
                  <Typography>Si no hay ganador: administradores (3 %): <strong>{currency.format(Number(selectedMonth.projection.adminCommission))}</strong> · Para repartir entre {selectedMonth.projection.eligibleCount} participantes al día: <strong>{currency.format(Number(selectedMonth.projection.noWinnerAmount))}</strong></Typography>
                  {selectedMonth.projection.noWinnerShares.length > 0 && (
                    <Typography variant="body2">Reparto estimado: {selectedMonth.projection.noWinnerShares.map((share) => {
                      const member = selectedMonth.entries.find((entry) => entry.memberId === share.memberId)?.member;
                      return `${displayName(member)}: ${currency.format(Number(share.amount))}`;
                    }).join(" · ")}</Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">La distribución definitiva depende de los pagos y la elegibilidad al cerrar el sorteo.</Typography>
                </>
              ) : (
                <>
                  <Typography>Para administradores: <strong>{currency.format(Number(selectedMonth.adminCommission))}</strong></Typography>
                  <Typography>{selectedMonth.winner ? "Para el ganador" : "Repartido entre participantes"}: <strong>{currency.format(selectedMonth.distributions.filter((item) => ["GANADOR", "SOCIO"].includes(item.type)).reduce((sum, item) => sum + Number(item.amount), 0))}</strong></Typography>
                  {selectedMonth.distributions.map((item) => (
                    <Typography variant="body2" key={item.id}>{item.type === "ADMINISTRADOR" ? "Administrador" : item.type === "GANADOR" ? "Ganador" : "Socio"} · {displayName(item.user || item.member)}: {currency.format(Number(item.amount))}</Typography>
                  ))}
                </>
              )}
            </Card>
          )}

          {isAdmin && selectedMonth ? (
            <Card sx={{ overflowX: "auto" }}>
              <Table>
                <TableHead><TableRow>
                  <TableCell>Socio</TableCell>
                  <TableCell>Valor del mes</TableCell>
                  <TableCell>Pago</TableCell>
                  <TableCell>Fecha de pago</TableCell>
                  <TableCell>Participa</TableCell>
                  <TableCell>Acciones</TableCell>
                </TableRow></TableHead>
                <TableBody>
                  {selectedMonth.entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{displayName(entry.member)}</TableCell>
                      <TableCell>{currency.format(Number(entry.amount))}</TableCell>
                      <TableCell>
                        {entry.status}
                        {Number(entry.discountedAmount) > 0 && (
                          <Typography variant="caption" display="block" color="text.secondary">
                            Descontado: {currency.format(Number(entry.discountedAmount))}
                            {Number(entry.discountedAmount) < Number(entry.amount) &&
                              ` · Pendiente: ${currency.format(Number(entry.amount) - Number(entry.discountedAmount))}`}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{entry.paidAt ? new Date(entry.paidAt).toLocaleString("es-CO") : "—"}</TableCell>
                      <TableCell>{entry.eligible ? "Sí" : "No"}</TableCell>
                      <TableCell>
                        {entry.paidAt && !selectedMonth.finalizedAt && (
                          <Button size="small" disabled={saving} onClick={() => openPaymentDate(entry)}>Modificar fecha</Button>
                        )}
                        {entry.paidAt && !selectedMonth.finalizedAt && (
                          <Button size="small" color="error" disabled={saving} onClick={() => annulPayment(entry)}>Anular pago</Button>
                        )}
                        {!entry.paidAt && ["PENDIENTE", "DESCUENTO PARCIAL"].includes(entry.status) &&
                          !selectedMonth.finalizedAt && (
                          <Button size="small" disabled={saving} onClick={() => openPaymentDate(entry)}>Registrar pago</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : !isAdmin && ownEntry ? (
            <Card sx={{ p: 2, display: "grid", gap: 1 }}>
              <Typography variant="h6">{monthNames[selectedMonth.month - 1]} · Vigencia {selectedMonth.vigencia.year}</Typography>
              <Typography>Valor de la cuota: <strong>{currency.format(Number(ownEntry.amount))}</strong></Typography>
              <Typography>Fecha y hora del sorteo: <strong>{new Date(selectedMonth.drawAt).toLocaleString("es-CO")}</strong></Typography>
              <Typography>Estado de mi pago: <strong>{ownEntry.status}</strong></Typography>
              <Typography>Participación en el sorteo: <strong>{ownEntry.eligible ? "Sí" : "No"}</strong></Typography>
              {Number(ownEntry.discountedAmount) > 0 && (
                <Typography>
                  Descontado de la liquidación: <strong>{currency.format(Number(ownEntry.discountedAmount))}</strong>
                  {Number(ownEntry.discountedAmount) < Number(ownEntry.amount) &&
                    ` · Pendiente: ${currency.format(Number(ownEntry.amount) - Number(ownEntry.discountedAmount))}`}
                </Typography>
              )}
              {selectedMonth.finalizedAt && (
                <Typography>
                  Resultado: <strong>{selectedMonth.winnerMemberId === ownEntry.memberId ? "Ganaste" : selectedMonth.winningNumber ? `Número ganador ${selectedMonth.winningNumber}` : "Sin ganador"}</strong>
                </Typography>
              )}
              {ownEntry.paidAt && <Typography>Fecha de pago registrada: {new Date(ownEntry.paidAt).toLocaleString("es-CO")}</Typography>}
              {selectedMonth.distributions?.length > 0 && (
                <Typography>
                  Valor asignado a mi cuenta: <strong>{currency.format(selectedMonth.distributions.reduce((sum, item) => sum + Number(item.amount), 0))}</strong>
                </Typography>
              )}
            </Card>
          ) : (
            <Card sx={{ p: 3 }}><Typography color="text.secondary">No existe un registro de cuota para este mes.</Typography></Card>
          )}
        </>
      )}

      <Dialog open={setupOpen} onClose={() => !saving && setSetupOpen(false)} fullWidth maxWidth="md">
        <Box component="form" onSubmit={saveSetup}>
          <DialogTitle>{configuredProgram ? "Modificar configuración de rifas" : "Configurar rifas de la vigencia"}</DialogTitle>
          <DialogContent sx={{ display: "grid", gap: 2, pt: "16px !important" }}>
            {error && <Alert severity="error">{error}</Alert>}
            <Alert severity="info">
              {configuredProgram
                ? "El nuevo valor solo aplica a sorteos nuevos. Las cuotas ya creadas conservan su valor. Puede agregar o cambiar fechas futuras; no se eliminan sorteos existentes ni se modifican sorteos cerrados."
                : "El valor se cobra por socio únicamente en los meses con sorteo. Deje en blanco los meses sin rifa; solo se crearán sorteos y cuotas para las fechas indicadas. Registre el pago antes de la fecha y hora del sorteo para que el socio participe."}
            </Alert>
            <TextField
              required type="number" label="Valor mensual por socio" value={monthlyAmount}
              onChange={(event) => setMonthlyAmount(event.target.value)}
              inputProps={{ min: 0.01, step: "0.01" }}
            />
            <Typography variant="subtitle1">Fechas y horas de los sorteos (opcionales por mes)</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
              {drawDates.map((item) => (
                <TextField
                  key={item.month}
                  type="datetime-local"
                  label={monthNames[item.month - 1]}
                  value={item.date}
                  disabled={Boolean(item.finalizedAt)}
                  inputProps={{
                    min: selectedVigencia ? `${selectedVigencia.year}-01-01T00:00` : undefined,
                    max: selectedVigencia ? `${selectedVigencia.year}-12-31T23:59` : undefined
                  }}
                  onChange={(event) => setDrawDates((current) => current.map((entry) =>
                    entry.month === item.month ? { ...entry, date: event.target.value } : entry
                  ))}
                  InputLabelProps={{ shrink: true }}
                />
              ))}
            </Box>
            <Typography variant="caption" color="text.secondary">
              Las fechas pueden ser cualquier día del año {selectedVigencia?.year}; no es obligatorio que coincidan con el mes indicado.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSetupOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={saving}>{saving ? "Guardando..." : configuredProgram ? "Guardar configuración" : "Crear calendario y cuotas"}</Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={drawOpen} onClose={() => !saving && setDrawOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={closeDraw}>
          <DialogTitle>Cerrar sorteo mensual</DialogTitle>
          <DialogContent sx={{ display: "grid", gap: 2, pt: "16px !important" }}>
            <Alert severity="info">
              Solo socios activos con la cuota pagada antes del sorteo participan. El 3 % se asigna a los administradores; si no hubo ganador, el resto se reparte entre esos participantes.
            </Alert>
            <TextField
              label="Número ganador (opcional)"
              value={winningNumber}
              onChange={(event) => setWinningNumber(event.target.value)}
              inputProps={{ maxLength: 20 }}
              helperText={`Debe pertenecer a un socio activo que pagó a tiempo: ${selectedMonth?.entries.filter((entry) => entry.eligible).map((entry) => entry.member.raffleNumber).filter(Boolean).join(", ") || "no hay participantes habilitados"}. Déjelo vacío si no hubo ganador.`}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDrawOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={saving}>{saving ? "Guardando..." : "Confirmar sorteo"}</Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={Boolean(paymentEntry)} onClose={() => !saving && setPaymentEntry(null)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={savePayment}>
          <DialogTitle>{paymentDateIsEdit ? "Modificar fecha de pago" : "Registrar pago"}</DialogTitle>
          <DialogContent sx={{ display: "grid", gap: 2, pt: "16px !important" }}>
            {error && <Alert severity="error">{error}</Alert>}
            <Alert severity="info">
              Indique la fecha real del pago. Si es posterior a la fecha del sorteo, el socio quedará pagado, pero no participará en ese sorteo.
            </Alert>
            <TextField
              required type="datetime-local" label="Fecha y hora del pago" value={paymentDate}
              onChange={(event) => setPaymentDate(event.target.value)}
              inputProps={{ max: toBogotaInput(new Date()) }}
              InputLabelProps={{ shrink: true }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPaymentEntry(null)} disabled={saving}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={saving || !paymentDate}>
              {saving ? "Guardando..." : paymentDateIsEdit ? "Guardar fecha" : "Registrar pago"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={editDrawDateOpen} onClose={() => !saving && setEditDrawDateOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={updateDrawDate}>
          <DialogTitle>Modificar fecha del sorteo</DialogTitle>
          <DialogContent sx={{ display: "grid", gap: 2, pt: "16px !important" }}>
            <Alert severity="info">
              La nueva fecha debe ser futura y estar dentro del año {selectedMonth?.vigencia.year}. Los pagos registrados después de la nueva fecha no participarán.
            </Alert>
            <TextField
              required
              type="datetime-local"
              label="Nueva fecha y hora"
              value={drawDate}
              inputProps={{
                min: selectedMonth ? `${selectedMonth.vigencia.year}-01-01T00:00` : undefined,
                max: selectedMonth ? `${selectedMonth.vigencia.year}-12-31T23:59` : undefined
              }}
              onChange={(event) => setDrawDate(event.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDrawDateOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={saving}>{saving ? "Guardando..." : "Guardar fecha"}</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
