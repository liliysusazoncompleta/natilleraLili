import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Grid, MenuItem, TextField, Typography } from "@mui/material";
import { api } from "../api";
import { useAuthStore } from "../store";
import { displayValue } from "../localization";
import FilterBar from "../components/FilterBar";

const emptyForm = { document: "", firstName: "", lastName: "", phone: "", raffleNumber: "", vigenciaId: "" };

export default function Members({ endpoint = "/socios", profileOnly = false }) {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [vigencias, setVigencias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filters, setFilters] = useState({ search: "", status: "", vigenciaId: "" });
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  function closePassword() {
    setPasswordOpen(false);
    setPasswords({ current: "", next: "", confirm: "" });
    setPasswordError("");
  }

  async function changePassword(event) {
    event.preventDefault();
    setPasswordError("");
    if (passwords.next !== passwords.confirm) {
      setPasswordError("La confirmación no coincide con la nueva contraseña");
      return;
    }
    setPasswordSaving(true);
    try {
      await api.post("/auth/cambiar-clave", { currentPassword: passwords.current, newPassword: passwords.next });
      closePassword();
      logout();
      navigate("/login", { replace: true, state: { message: "Contraseña actualizada. Inicie sesión nuevamente." } });
    } catch (err) {
      setPasswordError(err.response?.data?.error || "No fue posible cambiar la contraseña");
    } finally {
      setPasswordSaving(false);
    }
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = profileOnly ? {} : Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== ""));
      const { data } = await api.get(endpoint, { params });
      setItems(data.items || []);
      if (user?.role === "ADMINISTRADOR" && !profileOnly) {
        const vigenciasResponse = await api.get("/vigencias");
        setVigencias(vigenciasResponse.data.items || []);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Error al cargar socios");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(load, 250);
    return () => window.clearTimeout(timer);
  }, [endpoint, profileOnly, JSON.stringify(filters)]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(member) {
    setEditingId(member.id);
    setForm({
      document: member.document || "",
      firstName: member.firstName || "",
      lastName: member.lastName || "",
      phone: member.phone || "",
      raffleNumber: member.raffleNumber || "",
      vigenciaId: member.vigenciaId || ""
    });
    setOpen(true);
  }

  async function saveMember(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editingId) {
        await api.patch(`/socios/${editingId}`, form);
      } else {
        await api.post("/socios", form);
      }
      setOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "No fue posible guardar el socio");
    } finally {
      setSaving(false);
    }
  }

  async function deleteMember(member) {
    if (!window.confirm(`Eliminar a ${member.firstName} ${member.lastName}?`)) return;
    setError("");
    try {
      await api.delete(`/socios/${member.id}`);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "No fue posible eliminar el socio");
    }
  }

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h4">{profileOnly ? "Mi perfil" : "Socios"}</Typography>
        {profileOnly && <Button variant="contained" onClick={() => setPasswordOpen(true)}>Cambiar contraseña</Button>}
        {user?.role === "ADMINISTRADOR" && !profileOnly && <Button variant="contained" onClick={openCreate}>Nuevo socio</Button>}
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {profileOnly && <Dialog open={passwordOpen} onClose={() => !passwordSaving && closePassword()} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={changePassword}>
          <DialogTitle>Cambiar contraseña</DialogTitle>
          <DialogContent sx={{ display: "grid", gap: 2, pt: "16px !important" }}>
            {passwordError && <Alert severity="error">{passwordError}</Alert>}
            <TextField required type="password" autoComplete="current-password" label="Contraseña actual" value={passwords.current} onChange={(e) => setPasswords({ ...passwords, current: e.target.value })} />
            <TextField required type="password" autoComplete="new-password" inputProps={{ minLength: 8 }} helperText="Mínimo 8 caracteres. Al guardar deberá iniciar sesión nuevamente." label="Nueva contraseña" value={passwords.next} onChange={(e) => setPasswords({ ...passwords, next: e.target.value })} />
            <TextField required type="password" autoComplete="new-password" label="Confirmar nueva contraseña" value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} />
          </DialogContent>
          <DialogActions><Button disabled={passwordSaving} onClick={closePassword}>Cancelar</Button><Button disabled={passwordSaving} type="submit" variant="contained">{passwordSaving ? "Guardando..." : "Guardar contraseña"}</Button></DialogActions>
        </Box>
      </Dialog>}
      {!profileOnly && (
        <FilterBar
          filters={[
            { name: "search", label: "Buscar nombre, apellido o documento" },
            { name: "status", label: "Estado", options: [
              { value: "ACTIVO", label: "Activo" }, { value: "INACTIVO", label: "Inactivo" },
              { value: "ELIMINADO", label: "Eliminado" }
            ] },
            { name: "vigenciaId", label: "Vigencia", options: vigencias.map((vigencia) => ({ value: vigencia.id, label: String(vigencia.year) })) }
          ]}
          value={filters}
          onChange={(name, value) => setFilters((current) => ({ ...current, [name]: value }))}
          onClear={() => setFilters({ search: "", status: "", vigenciaId: "" })}
        />
      )}
      {loading ? <CircularProgress /> : (
        <Grid container spacing={2}>
          {items.map((member) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={member.id}>
              <Box sx={{ p: 2, bgcolor: "white", borderRadius: 3, boxShadow: 1 }}>
                <Typography fontWeight={800}>{member.firstName} {member.lastName}</Typography>
                {member.document && <Typography variant="body2" color="text.secondary">Documento: {member.document}</Typography>}
                <Typography variant="body2" color="text.secondary">Número de rifa: {member.raffleNumber || "—"}</Typography>
                {member.phone && <Typography variant="body2" color="text.secondary">Teléfono: {member.phone}</Typography>}
                {member.email && <Typography variant="body2" color="text.secondary">Correo: {member.email}</Typography>}
                {member.address && <Typography variant="body2" color="text.secondary">Dirección: {member.address}</Typography>}
                <Box sx={{ mt: 1, display: "flex", gap: 1 }}>
                  <Chip label={displayValue("status", member.status)} size="small" color={member.status === "ACTIVO" ? "success" : "default"} />
                  <Chip label={displayValue("role", member.role)} size="small" variant="outlined" />
                </Box>
                {user?.role === "ADMINISTRADOR" && !profileOnly && (
                  <Box sx={{ mt: 2, display: "flex", gap: 1 }}>
                    <Button size="small" onClick={() => openEdit(member)}>Editar</Button>
                    <Button size="small" color="error" onClick={() => deleteMember(member)}>Eliminar</Button>
                  </Box>
                )}
              </Box>
            </Grid>
          ))}
        </Grid>
      )}
      {!profileOnly && <Dialog open={open} onClose={() => !saving && setOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={saveMember}>
          <DialogTitle>{editingId ? "Editar socio" : "Nuevo socio"}</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid size={{ xs: 12, sm: 6 }}><TextField required fullWidth label="Documento" value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><TextField required fullWidth label="Nombres" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><TextField required fullWidth label="Apellidos" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Teléfono" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Número rifa" value={form.raffleNumber} onChange={(e) => setForm({ ...form, raffleNumber: e.target.value })} /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField select required fullWidth label="Vigencia" value={form.vigenciaId} onChange={(e) => setForm({ ...form, vigenciaId: e.target.value })}>
                  {vigencias.map((vigencia) => <MenuItem key={vigencia.id} value={vigencia.id}>{vigencia.year}</MenuItem>)}
                </TextField>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
          </DialogActions>
        </Box>
      </Dialog>}
    </Box>
  );
}
