import { useEffect, useState } from "react";
import { Grid, Card, CardContent, Typography, Box, CircularProgress, Alert } from "@mui/material";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { api } from "../api";
import { useAuthStore } from "../store";
import FilterBar from "../components/FilterBar";

const colors = ["#12372A", "#D4A72C", "#5F8D4E", "#C84C3C", "#4D77FF"];
const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function Kpi({ label, value, currency = true }) {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Typography color="text.secondary" variant="body2">{label}</Typography>
        <Typography variant="h5" fontWeight={800}>
          {value == null ? "No disponible" : currency
            ? new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 2 }).format(Number(value))
            : String(value ?? "—")}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const user = useAuthStore((state) => state.user);
  const [vigencias, setVigencias] = useState([]);
  const [vigenciaId, setVigenciaId] = useState("");

  useEffect(() => {
    api.get("/dashboard", { params: vigenciaId ? { vigenciaId } : {} }).then(({ data }) => setData(data)).catch((err) => setError(err.response?.data?.error || "No fue posible cargar el dashboard"));
  }, [vigenciaId]);

  useEffect(() => {
    if (user?.role === "ADMINISTRADOR") {
      api.get("/vigencias", { params: { pageSize: 100 } }).then(({ data }) => setVigencias(data.items || [])).catch(() => setVigencias([]));
    }
  }, [user?.role]);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return <Box sx={{ display: "grid", placeItems: "center", minHeight: 300 }}><CircularProgress /></Box>;

  const savings = [
    { name: "Ahorros", value: Number(data.totalAhorrado) },
    { name: "Prestado", value: Number(data.totalPrestado) },
    { name: "Cartera", value: Number(data.carteraPendiente) }
  ];
  const gains = [
    { name: "Actividades", value: Number(data.gananciasActividades) },
    { name: "Préstamos", value: Number(data.gananciasPrestamos) },
    { name: "Rifas", value: Number(data.gananciasRifas) }
  ];

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>{user?.role === "SOCIO" ? "Mi resumen financiero" : "Resumen ejecutivo"}</Typography>
      <FilterBar
        filters={[{ name: "vigenciaId", label: "Vigencia", options: vigencias.map((vigencia) => ({ value: vigencia.id, label: String(vigencia.year) })) }]}
        value={{ vigenciaId }}
        onChange={(_, value) => setVigenciaId(value)}
        onClear={() => setVigenciaId("")}
      />
      <Grid container spacing={2}>
        {user?.role === "SOCIO" ? (
          <>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}><Kpi label="Mi ahorro acumulado" value={data.totalAhorrado} /></Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}><Kpi label="Mis préstamos y avales" value={data.totalPrestado} /></Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}><Kpi label="Capital pendiente" value={data.carteraPendiente} /></Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}><Kpi label="Mis deudas" value={data.deudasPendientes} /></Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}><Kpi label="Número de rifa" value={data.numeroRifa || "-"} currency={false} /></Grid>
            {Object.hasOwn(data, "gananciasPropias") && (
              <Grid size={{ xs: 12, sm: 6, md: 3 }}><Kpi label="Mis ganancias" value={data.gananciasPropias} /></Grid>
            )}
            {Object.hasOwn(data, "valorProyectadoLiquidacion") && <Grid size={{ xs: 12, sm: 6, md: 3 }}><Kpi label="Liquidación registrada" value={data.valorProyectadoLiquidacion} /></Grid>}
          </>
        ) : (
          <>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}><Kpi label="Total ahorrado" value={data.totalAhorrado} /></Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}><Kpi label="Total prestado" value={data.totalPrestado} /></Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}><Kpi label="Cartera pendiente" value={data.carteraPendiente} /></Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}><Kpi label="Capital recuperado" value={data.capitalRecuperado} /></Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}><Kpi label="Intereses generados" value={data.interesesGenerados} /></Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}><Kpi label="Intereses recaudados" value={data.interesesRecaudados} /></Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}><Kpi label="Intereses pendientes" value={data.interesesPendientes} /></Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}><Kpi label="Préstamos activos" value={data.prestamosActivos} currency={false} /></Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}><Kpi label="Préstamos finalizados" value={data.prestamosFinalizados} currency={false} /></Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}><Kpi label="Socios activos" value={data.sociosActivos} currency={false} /></Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}><Kpi label="Ganancias actividades" value={data.gananciasActividades} /></Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}><Kpi label="Ganancias préstamos" value={data.gananciasPrestamos} /></Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}><Kpi label="Ganancias rifas" value={data.gananciasRifas} /></Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}><Kpi label="Valor a entregar" value={data.valorTotalEntregar} /></Grid>
            <Grid size={{ xs: 12, md: 7 }}>
              <Card><CardContent><Typography fontWeight={700} sx={{ mb: 2 }}>Estado financiero</Typography>
                <Box sx={{ height: 280 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={savings}><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="value" fill="#12372A" radius={[6,6,0,0]} /></BarChart></ResponsiveContainer></Box>
              </CardContent></Card>
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <Card><CardContent><Typography fontWeight={700} sx={{ mb: 2 }}>Distribución de ganancias</Typography>
                <Box sx={{ height: 280 }}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={gains} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>{gains.map((_, i) => <Cell key={i} fill={colors[i]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></Box>
              </CardContent></Card>
            </Grid>
          </>
        )}
      </Grid>
      {user?.role === "SOCIO" && Object.hasOwn(data, "rifasPendientes") && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>Mis rifas de la vigencia</Typography>
          {data.rifasPendientes.length === 0 ? (
            <Alert severity="info">No tienes cuotas de rifas pendientes para esta vigencia.</Alert>
          ) : (
            <Grid container spacing={2}>
              {data.rifasPendientes.map((raffle) => (
                <Grid key={raffle.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Card sx={{ height: "100%" }}>
                    <CardContent>
                      <Typography variant="subtitle1" fontWeight={700}>
                        {monthNames[raffle.month - 1]} · {new Date(raffle.drawAt).toLocaleDateString("es-CO")}
                      </Typography>
                      <Typography>
                        Cuota: {new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP" }).format(Number(raffle.amount))}
                      </Typography>
                      <Typography color={raffle.participates ? "success.main" : raffle.status === "DESCONTADO" ? "success.main" : "error.main"} fontWeight={600}>
                        {raffle.participates
                          ? "Pago al día: participaste en el sorteo"
                          : raffle.status === "DESCONTADO"
                            ? "Cuota descontada de la liquidación anual"
                            : raffle.status === "DESCUENTO PARCIAL"
                              ? `Descuento parcial: ${new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP" }).format(Number(raffle.discountedAmount))}; no participaste`
                              : "Cuota pendiente: no participas en el sorteo"}
                      </Typography>
                      {raffle.paidAt && <Typography variant="body2" color="text.secondary">Pago registrado: {new Date(raffle.paidAt).toLocaleString("es-CO")}</Typography>}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}
    </Box>
  );
}
