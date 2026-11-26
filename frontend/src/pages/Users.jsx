import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, MenuItem, Table, TableBody, TableCell, TableHead, TableRow, TextField,
  Typography
} from "@mui/material";
import { api } from "../api";
import { displayValue, labelForField } from "../localization";
import FilterBar from "../components/FilterBar";

const initialForm = { email: "", username: "", firstName: "", lastName: "", document: "", password: "", role: "SOCIO", memberId: "" };

export default function Users() {
  const [users, setUsers] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [accesses, setAccesses] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [filters, setFilters] = useState({ search: "", role: "", status: "" });

  async function load() {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== ""));
      params.pageSize = 100;
      const usersResponse = await api.get("/usuarios", { params });
      const allMembers = [];
      let page = 1;
      let total;
      do {
        const { data } = await api.get("/socios", { params: { page, pageSize: 100 } });
        if (!Array.isArray(data.items) || (data.items.length === 0 && allMembers.length < data.total)) {
          throw new Error("No fue posible obtener todos los perfiles de socio");
        }
        allMembers.push(...data.items);
        total = data.total;
        page += 1;
      } while (allMembers.length < total);
      setUsers(usersResponse.data.items || []);
      setMembers(allMembers);
      setError("");
    } catch (err) {
      setError(err.response?.data?.error || err.message || "No fue posible cargar los usuarios");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    const timer = window.setTimeout(load, 250);
    return () => window.clearTimeout(timer);
  }, [JSON.stringify(filters)]);

  function openCreate() {
    setError("");
    setEditingId(null);
    setForm(initialForm);
    setFormOpen(true);
  }

  function openEdit(user) {
    setError("");
    setEditingId(user.id);
    setForm({
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      document: user.document || "",
      password: "",
      role: user.role,
      memberId: user.member?.id || ""
    });
    setFormOpen(true);
  }

  async function saveUser(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editingId) {
        await api.patch(`/usuarios/${editingId}`, { ...form, memberId: form.memberId || undefined });
      } else {
        await api.post("/usuarios", { ...form, memberId: form.role === "SOCIO" ? form.memberId : undefined });
      }
      setFormOpen(false);
      setEditingId(null);
      setForm(initialForm);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "No fue posible crear el usuario");
    } finally { setSaving(false); }
  }

  async function updateUser(user, changes) {
    setError("");
    try {
      await api.patch(`/usuarios/${user.id}`, changes);
      await load();
    } catch (err) { setError(err.response?.data?.error || "No fue posible actualizar el usuario"); }
  }

  async function changeStatus(user, status) {
    setError("");
    try {
      await api.patch(`/usuarios/${user.id}/estado`, { status });
      await load();
    } catch (err) { setError(err.response?.data?.error || "No fue posible cambiar el estado"); }
  }

  async function resetPassword(user) {
    const password = window.prompt(`Nueva contraseña para ${user.username} (mínimo 8 caracteres):`);
    if (!password) return;
    try {
      await api.post(`/usuarios/${user.id}/restablecer-clave`, { password });
      window.alert("Contraseña restablecida. Las sesiones activas de este usuario se cerraron.");
    } catch (err) { setError(err.response?.data?.error || "No fue posible restablecer la contraseña"); }
  }

  async function showAccessHistory(user) {
    setSelectedUser(user);
    setAccessOpen(true);
    try {
      const { data } = await api.get(`/usuarios/${user.id}/accesos`);
      setAccesses(data.items || []);
    } catch (err) { setError(err.response?.data?.error || "No fue posible cargar el historial"); }
  }

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h4">Administración de usuarios</Typography>
        <Button variant="contained" onClick={openCreate}>Crear usuario</Button>
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <FilterBar
        filters={[
          { name: "search", label: "Buscar usuario" },
          { name: "role", label: "Rol", options: [
            { value: "ADMINISTRADOR", label: "Administrador" },
            { value: "SOCIO", label: "Socio" }
          ] },
          { name: "status", label: "Estado", options: [
            { value: "ACTIVO", label: "Activo" }, { value: "INACTIVO", label: "Inactivo" },
            { value: "BLOQUEADO", label: "Bloqueado" }, { value: "ELIMINADO", label: "Eliminado" }
          ] }
        ]}
        value={filters}
        onChange={(name, value) => setFilters((current) => ({ ...current, [name]: value }))}
        onClear={() => setFilters({ search: "", role: "", status: "" })}
      />
      {loading ? <CircularProgress /> : (
        <Box sx={{ overflowX: "auto", bgcolor: "white", borderRadius: 2 }}>
          <Table size="small">
            <TableHead><TableRow>{["firstName", "lastName", "document", "email", "username", "role", "status", "createdAt", "lastLoginAt"].map((key) => <TableCell key={key}>{labelForField(key)}</TableCell>)}<TableCell>Acciones</TableCell></TableRow></TableHead>
            <TableBody>{users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.firstName}</TableCell><TableCell>{user.lastName}</TableCell>
                <TableCell>{user.document || "—"}</TableCell><TableCell>{user.email}</TableCell><TableCell>{user.username}</TableCell>
                <TableCell>
                  <TextField select size="small" value={user.role} onChange={(event) => updateUser(user, { role: event.target.value })}>
                    <MenuItem value="ADMINISTRADOR">Administrador</MenuItem><MenuItem value="SOCIO">Socio</MenuItem>
                  </TextField>
                </TableCell>
                <TableCell><Chip size="small" label={displayValue("status", user.status)} color={user.status === "ACTIVO" ? "success" : user.status === "BLOQUEADO" ? "error" : "default"} /></TableCell>
                <TableCell>{displayValue("createdAt", user.createdAt)}</TableCell><TableCell>{displayValue("lastLoginAt", user.lastLoginAt)}</TableCell>
                <TableCell>
                  <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                    <Button size="small" onClick={() => openEdit(user)}>Editar</Button>
                    <Button size="small" onClick={() => changeStatus(user, user.status === "ACTIVO" ? "INACTIVO" : "ACTIVO")}>{user.status === "ACTIVO" ? "Desactivar" : "Reactivar"}</Button>
                    <Button size="small" color="warning" onClick={() => changeStatus(user, "BLOQUEADO")}>Bloquear</Button>
                    <Button size="small" onClick={() => resetPassword(user)}>Restablecer clave</Button>
                    <Button size="small" onClick={() => showAccessHistory(user)}>Accesos</Button>
                  </Box>
                </TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </Box>
      )}

      <Dialog open={formOpen} onClose={() => !saving && setFormOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={saveUser}>
          <DialogTitle>{editingId ? "Editar usuario" : "Crear usuario"}</DialogTitle>
          <DialogContent sx={{ display: "grid", gap: 2, pt: "16px !important" }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField required label="Nombres" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            <TextField required label="Apellidos" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            <TextField label="Documento" value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} />
            <TextField required type="email" label="Correo electrónico" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <TextField required label="Nombre de usuario" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            {!editingId && <TextField required type="password" inputProps={{ minLength: 8 }} helperText="Mínimo 8 caracteres; el usuario podrá cambiarla desde Mi perfil." label="Contraseña temporal" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />}
            <TextField select label="Rol" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value, memberId: "" })}>
              <MenuItem value="SOCIO">Socio</MenuItem><MenuItem value="ADMINISTRADOR">Administrador</MenuItem>
            </TextField>
            {editingId && (
              <TextField select label="Perfil de socio asociado (opcional)" value={form.memberId} onChange={(e) => setForm({ ...form, memberId: e.target.value })}>
                <MenuItem value="" disabled={Boolean(users.find((user) => user.id === editingId)?.member)}>Sin perfil asociado</MenuItem>
                {members.filter((member) => !member.userId || member.userId === editingId).map((member) => <MenuItem key={member.id} value={member.id}>{member.firstName} {member.lastName} — {member.document}</MenuItem>)}
              </TextField>
            )}
          </DialogContent>
          <DialogActions><Button onClick={() => setFormOpen(false)}>Cancelar</Button><Button type="submit" variant="contained" disabled={saving}>{saving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear"}</Button></DialogActions>
        </Box>
      </Dialog>

      <Dialog open={accessOpen} onClose={() => setAccessOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Historial de acceso — {selectedUser?.username}</DialogTitle>
        <DialogContent>
          <Table size="small"><TableHead><TableRow><TableCell>Fecha</TableCell><TableCell>Evento</TableCell><TableCell>Resultado</TableCell><TableCell>Dirección IP</TableCell></TableRow></TableHead>
            <TableBody>{accesses.map((access) => <TableRow key={access.id}><TableCell>{displayValue("createdAt", access.createdAt)}</TableCell><TableCell>{displayValue("action", access.event)}</TableCell><TableCell>{access.success ? "Correcto" : "Fallido"}</TableCell><TableCell>{access.ipAddress || "—"}</TableCell></TableRow>)}</TableBody>
          </Table>
          {!accesses.length && <Typography sx={{ py: 2 }}>No hay accesos registrados.</Typography>}
        </DialogContent>
        <DialogActions><Button onClick={() => setAccessOpen(false)}>Cerrar</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
