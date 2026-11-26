import { useEffect, useState } from "react";
import { Alert, Box, Card, CardContent, CircularProgress, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { api } from "../api";
import { useAuthStore } from "../store";
import FilterBar from "../components/FilterBar";

const money = (value) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 2 }).format(Number(value || 0));
const dateLabel = (value) => value ? new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(new Date(value)) : "—";

export default function Debts() {
  const user = useAuthStore((state) => state.user);
  const [debts, setDebts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [vigencias, setVigencias] = useState([]);
  const [filters, setFilters] = useState({ search: "", status: "", vigenciaId: "" });
  const [pending, setPending] = useState({ items: [], totals: null });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = Object.fromEntries(
        Object.entries(filters).filter(([name, value]) => value !== "" && name !== "status")
      );
      api.get("/deudas/pendientes", { params })
        .then(({ data }) => setPending(data))
        .catch((err) => setError(err.response?.data?.error || "No fue posible consultar los pendientes por concepto"));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
    const debtParams = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== ""));
    debtParams.pageSize = 100;
    Promise.all([
      api.get("/deudas", { params: debtParams }),
      api.get("/prestamos/resumen", { params: debtParams.vigenciaId ? { vigenciaId: debtParams.vigenciaId } : {} })
    ])
      .then(([debtsResponse, summaryResponse]) => {
        setDebts(debtsResponse.data.items || []);
        setSummary(summaryResponse.data);
      })
      .catch((err) => setError(err.response?.data?.error || "No fue posible consultar las deudas"))
      .finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    if (user?.role === "ADMINISTRADOR") {
      api.get("/vigencias", { params: { pageSize: 100 } }).then(({ data }) => setVigencias(data.items || [])).catch(() => setVigencias([]));
    }
  }, [user?.role]);

  const totalDebt = Number(summary?.capitalPendiente || 0) + Number(summary?.interesesPendientes || 0);
  const pendingCount = summary?.prestamosConDeuda || 0;

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>Deudas y cartera</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <FilterBar
        filters={[
          { name: "search", label: "Buscar prestatario" },
          { name: "status", label: "Estado", options: [
            { value: "PENDIENTE", label: "Pendiente" },
            { value: "CANCELADA", label: "Cancelada" }
          ] },
          ...(user?.role === "ADMINISTRADOR" ? [{
            name: "vigenciaId", label: "Vigencia", options: vigencias.map((vigencia) => ({ value: vigencia.id, label: String(vigencia.year) }))
          }] : [])
        ]}
        value={filters}
        onChange={(name, value) => setFilters((current) => ({ ...current, [name]: value }))}
        onClear={() => setFilters({ search: "", status: "", vigenciaId: "" })}
      />
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 2, mb: 3 }}>
        {[
          ["Total prestado", summary?.capitalPrestadoTotal || 0],
          ...(user?.role === "ADMINISTRADOR" ? [["Capital recuperado", summary?.capitalRecuperado || 0]] : []),
          ["Capital pendiente", summary?.capitalPendiente || 0],
          ...(user?.role === "ADMINISTRADOR" ? [["Intereses generados", summary?.interesesGenerados || 0]] : []),
          ["Intereses pendientes", summary?.interesesPendientes || 0],
          ...(user?.role === "ADMINISTRADOR" ? [["Total por cobrar", totalDebt]] : []),
          ["Préstamos activos", summary?.prestamosActivos || 0, true],
          ["Préstamos finalizados", summary?.prestamosFinalizados || 0, true],
          ...(user?.role === "ADMINISTRADOR" ? [
            ["Socios con deuda", summary?.sociosConDeuda || 0, true],
            ["Socios al día", summary?.sociosAlDia || 0, true]
          ] : []),
          ["Préstamos con deuda", pendingCount, true]
        ].map(([label, amount, isCount]) => (
          <Card key={label}><CardContent>
            <Typography color="text.secondary" variant="body2">{label}</Typography>
            <Typography variant="h6">{isCount ? new Intl.NumberFormat("es-CO").format(Number(amount)) : money(amount)}</Typography>
          </CardContent></Card>
        ))}
      </Box>
      {loading ? <CircularProgress /> : <Card sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead><TableRow>
            {["Socio / prestatario", "Valor prestado", "Capital pendiente", "Intereses pendientes", "Total adeudado", "Total abonado", "Último pago", "Estado"].map((label) => <TableCell key={label}>{label}</TableCell>)}
          </TableRow></TableHead>
          <TableBody>
            {debts.map((debt) => <TableRow key={debt.id}>
              <TableCell>{debt.member ? `${debt.member.firstName} ${debt.member.lastName}` : debt.borrowerName}</TableCell>
              <TableCell>{money(debt.principal)}</TableCell>
              <TableCell>{money(debt.capitalPendiente)}</TableCell>
              <TableCell>{money(debt.interesesPendientes)}</TableCell>
              <TableCell>{money(debt.amount)}</TableCell>
              <TableCell>{money(debt.totalAbonado)}</TableCell>
              <TableCell>{dateLabel(debt.lastPaymentDate)}</TableCell>
              <TableCell>{debt.status}</TableCell>
            </TableRow>)}
            {!debts.length && <TableRow><TableCell colSpan={8} align="center">No hay deudas pendientes.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>}
      {debts.some((debt) => debt.paymentHistoryMismatch) && <Alert severity="warning" sx={{ mt: 2 }}>
        El historial de pagos no coincide con la reducción de capital de uno o más préstamos. El total abonado incluye solo pagos registrados no anulados; solicite al administrador revisar los movimientos históricos.
      </Alert>}
      <Typography variant="h6" sx={{ mt: 4, mb: 1 }}>Pendientes por socio y concepto</Typography>
      {pending.totals && (
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 2, mb: 2 }}>
          {[
            ["Actividades pendientes", pending.totals.activities],
            ["Ventas pendientes", pending.totals.sales],
            ["Rifas pendientes", pending.totals.raffles],
            ["Préstamos pendientes", pending.totals.loans],
            ["Total pendiente", pending.totals.total]
          ].map(([label, amount]) => (
            <Card key={label}><CardContent>
              <Typography color="text.secondary" variant="body2">{label}</Typography>
              <Typography variant="h6">{money(amount)}</Typography>
            </CardContent></Card>
          ))}
        </Box>
      )}
      <Card sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead><TableRow>
            {["Socio", "Concepto", "Detalle", "Valor pendiente"].map((label) => <TableCell key={label}>{label}</TableCell>)}
          </TableRow></TableHead>
          <TableBody>
            {pending.items.flatMap((item) => {
              const rows = [
                ...item.activities.map((detail) => ({
                  key: `a-${detail.activityId}`, concept: "Actividad",
                  detail: `${detail.name} (abonado ${money(detail.amountPaid)} de ${money(detail.amountDue)})`,
                  pending: detail.pending
                })),
                ...item.sales.map((detail) => ({
                  key: `v-${detail.saleId}`, concept: "Venta de actividad",
                  detail: `${detail.name}: ${detail.quantity} × ${detail.product} (abonado ${money(detail.amountPaid)} de ${money(detail.amountDue)})`,
                  pending: detail.pending
                })),
                ...item.raffles.map((detail) => ({
                  key: `r-${detail.raffleMonthId}`, concept: "Rifa",
                  detail: `Cuota del sorteo del ${dateLabel(detail.drawAt)}`, pending: detail.pending
                })),
                ...item.loans.map((detail) => ({
                  key: `l-${detail.loanId}`, concept: detail.type === "PARTICULAR" ? "Préstamo avalado" : "Préstamo",
                  detail: `${detail.type === "PARTICULAR" ? `Deudor: ${detail.borrowerName} · ` : ""}Capital ${money(detail.capital)} + intereses ${money(detail.interest)}`, pending: detail.pending
                }))
              ];
              return [
                ...rows.map((row, index) => (
                  <TableRow key={`${item.memberId}-${row.key}`}>
                    <TableCell>{index === 0 ? item.memberName : ""}</TableCell>
                    <TableCell>{row.concept}</TableCell>
                    <TableCell>{row.detail}</TableCell>
                    <TableCell>{money(row.pending)}</TableCell>
                  </TableRow>
                )),
                <TableRow key={`${item.memberId}-total`} sx={{ bgcolor: "action.hover" }}>
                  <TableCell colSpan={3}><strong>Total pendiente de {item.memberName}</strong></TableCell>
                  <TableCell><strong>{money(item.totals.total)}</strong></TableCell>
                </TableRow>
              ];
            })}
            {!pending.items.length && <TableRow><TableCell colSpan={4} align="center">No hay pendientes por actividades, ventas, rifas ni préstamos.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        La cartera de préstamos y los pendientes por actividad, ventas y rifas se calculan a partir de sus registros y abonos. No se crean deudas independientes.
      </Typography>
    </Box>
  );
}
