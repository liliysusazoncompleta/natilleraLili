import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Alert, Box, Button, Card, CardContent, Container, TextField, Typography } from "@mui/material";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import { api, apiConfig } from "../api";
import { useAuthStore } from "../store";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((state) => state.setSession);
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      const { data } = await api.post("/auth/login", form);
      setSession(data);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.error || "No fue posible iniciar sesión");
    }
  }

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "linear-gradient(135deg,#12372A,#1B5E45)" }}>
      <Container maxWidth="xs">
        <Card elevation={10}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ textAlign: "center", mb: 3 }}>
              <AccountBalanceIcon color="secondary" sx={{ fontSize: 52 }} />
              <Typography variant="h5" fontWeight={800}>La Natillera de Lili</Typography>
              <Typography color="text.secondary">Gestión financiera comunitaria</Typography>
            </Box>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {location.state?.message && <Alert severity="success" sx={{ mb: 2 }}>{location.state.message}</Alert>}
            <Box component="form" onSubmit={submit}>
              <TextField fullWidth label="Correo o nombre de usuario" margin="normal" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <TextField fullWidth label="Contraseña" margin="normal" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <Button fullWidth size="large" variant="contained" type="submit" disabled={Boolean(apiConfig.error)} sx={{ mt: 2 }}>Iniciar sesión</Button>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
