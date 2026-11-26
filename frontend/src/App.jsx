import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuthStore } from "./store";

const Login = lazy(() => import("./pages/Login"));
const Layout = lazy(() => import("./pages/Layout"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Members = lazy(() => import("./pages/Members"));
const Users = lazy(() => import("./pages/Users"));
const Permissions = lazy(() => import("./pages/Permissions"));
const SimpleModule = lazy(() => import("./pages/SimpleModule"));
const Payments = lazy(() => import("./pages/Payments"));
const Debts = lazy(() => import("./pages/Debts"));
const Raffles = lazy(() => import("./pages/Raffles"));
const Activities = lazy(() => import("./pages/Activities"));
const Help = lazy(() => import("./pages/Help"));
const Liquidations = lazy(() => import("./pages/Liquidations"));

function Protected({ children }) {
  const user = useAuthStore((state) => state.user);
  return user ? children : <Navigate to="/login" replace />;
}

function AdminOnly({ children }) {
  const user = useAuthStore((state) => state.user);
  return user?.role === "ADMINISTRADOR" ? children : <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <Suspense fallback={<div role="status" aria-live="polite">Cargando módulo...</div>}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Protected><Layout /></Protected>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="socios" element={<Members />} />
          <Route path="perfil" element={<Members endpoint="/perfil" profileOnly />} />
          <Route path="ayuda" element={<Help />} />
          <Route path="usuarios" element={<AdminOnly><Users /></AdminOnly>} />
          <Route path="configuracion/permisos" element={<AdminOnly><Permissions /></AdminOnly>} />
          <Route path="ahorros" element={<SimpleModule title="Ahorros" endpoint="/ahorros" fields={[
          { name: "memberId", label: "Socio", optionsFrom: "/socios", optionLabel: (item) => `${item.firstName} ${item.lastName}` },
          { name: "vigenciaId", label: "Vigencia", optionsFrom: "/vigencias", optionLabel: (item) => String(item.year) },
          { name: "amount", label: "Monto", type: "number" },
          { name: "date", label: "Fecha", type: "date" },
          { name: "observation", label: "Observación", required: false }
        ]} filterConfig={[
          { name: "search", label: "Buscar socio u observación" },
          { name: "memberId", label: "Socio", optionsFrom: "/socios", optionLabel: (item) => `${item.firstName} ${item.lastName}` },
          { name: "vigenciaId", label: "Vigencia", optionsFrom: "/vigencias", optionLabel: (item) => String(item.year) }
          ]} />} />
          <Route path="prestamos" element={<SimpleModule title="Préstamos" endpoint="/prestamos" fields={[
          { name: "type", label: "Tipo de deudor", defaultValue: "SOCIO", choices: [{ value: "SOCIO", label: "Socio" }, { value: "PARTICULAR", label: "Particular" }] },
          { name: "vigenciaId", label: "Vigencia", optionsFrom: "/vigencias", optionLabel: (item) => String(item.year) },
          { name: "memberId", label: "Socio deudor", optionsFrom: "/socios", optionLabel: (item) => `${item.firstName} ${item.lastName} — ${item.document}` },
          { name: "borrowerName", label: "Nombre del deudor particular", showFor: "PARTICULAR" },
          { name: "principal", label: "Monto", type: "number", inputProps: { min: 0.01, step: 0.01, max: 999999999999.99 } },
          { name: "rate", label: "Tasa mensual (%)", type: "number", inputProps: { min: 0, max: 999.99, step: 0.01 } },
          { name: "date", label: "Fecha de desembolso", type: "date", required: false },
          { name: "interestStartDays", label: "Días después del desembolso para iniciar intereses", type: "number", inputProps: { min: 1, max: 36500, step: 1 }, helperText: "El primer interés se genera al cumplirse estos días; luego, cada mes." },
          { name: "observations", label: "Observaciones", required: false }
        ]} filterConfig={[
          { name: "search", label: "Buscar prestatario" },
          { name: "memberId", label: "Socio", optionsFrom: "/socios", optionLabel: (item) => `${item.firstName} ${item.lastName}` },
          { name: "vigenciaId", label: "Vigencia", optionsFrom: "/vigencias", optionLabel: (item) => String(item.year) },
          { name: "status", label: "Estado", options: [
            { value: "ACTIVO", label: "Activo" }, { value: "FINALIZADO", label: "Finalizado" },
            { value: "PAGADO", label: "Pagado" }, { value: "VENCIDO", label: "Vencido" }
          ] }
          ]} />} />
          <Route path="pagos" element={<Payments />} />
          <Route path="actividades" element={<Activities />} />
          <Route path="rifas" element={<Raffles />} />
          <Route path="deudas" element={<Debts />} />
          <Route path="vigencias" element={<AdminOnly><SimpleModule title="Vigencias" endpoint="/vigencias" fields={[
          { name: "year", label: "Año", type: "number" }
        ]} filterConfig={[
          { name: "search", label: "Buscar vigencia" },
          { name: "status", label: "Estado", options: [
            { value: "ABIERTA", label: "Abierta" }, { value: "CERRADA", label: "Cerrada" },
            { value: "LIQUIDADA", label: "Liquidada" }
          ] }
          ]} /></AdminOnly>} />
          <Route path="liquidaciones" element={<Liquidations />} />
          <Route path="reportes" element={<SimpleModule title="Reportes" endpoint="/reportes" filterConfig={[
          { name: "search", label: "Buscar reporte" },
          { name: "vigenciaId", label: "Vigencia", optionsFrom: "/vigencias", optionLabel: (item) => String(item.year) }
          ]} />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}
