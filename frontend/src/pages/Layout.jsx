import { useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { AppBar, Avatar, Box, Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Toolbar, Typography } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PeopleIcon from "@mui/icons-material/People";
import SavingsIcon from "@mui/icons-material/Savings";
import PaymentsIcon from "@mui/icons-material/Payments";
import EventIcon from "@mui/icons-material/Event";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import AssessmentIcon from "@mui/icons-material/Assessment";
import LogoutIcon from "@mui/icons-material/Logout";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import SettingsIcon from "@mui/icons-material/Settings";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import { useAuthStore } from "../store";
import { api } from "../api";

const width = 248;
const links = [
  ["/dashboard", "Dashboard", <DashboardIcon />],
  ["/socios", "Socios", <PeopleIcon />],
  ["/perfil", "Mi perfil", <PeopleIcon />, "perfil"],
  ["/ayuda", "Ayuda", <HelpOutlineIcon />],
  ["/ahorros", "Ahorros", <SavingsIcon />],
  ["/prestamos", "Préstamos", <PaymentsIcon />],
  ["/pagos", "Pagos", <PaymentsIcon />],
  ["/actividades", "Actividades", <EventIcon />],
  ["/rifas", "Rifas", <ConfirmationNumberIcon />],
  ["/deudas", "Deudas", <AccountBalanceIcon />],
  ["/vigencias", "Vigencias", <EventIcon />],
  ["/liquidaciones", "Liquidaciones", <PaymentsIcon />],
  ["/reportes", "Reportes", <AssessmentIcon />],
  ["/usuarios", "Usuarios", <ManageAccountsIcon />, "usuarios"],
  ["/configuracion/permisos", "Roles y permisos", <SettingsIcon />, "configuracion"]
];

export default function Layout() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [permissions, setPermissions] = useState(null);
  const [permissionsError, setPermissionsError] = useState("");
  const [permissionsVersion, setPermissionsVersion] = useState(0);

  useEffect(() => {
    if (user?.role !== "ADMINISTRADOR") {
      let active = true;
      api.get("/auth/permisos").then(({ data }) => {
        if (active) { setPermissions(data.permissions); setPermissionsError(""); }
      }).catch(() => {
        if (active) { setPermissions(null); setPermissionsError("No fue posible consultar sus permisos. Intente nuevamente."); }
      });
      return () => { active = false; };
    }
  }, [user?.id, user?.role, permissionsVersion]);

  const visibleLinks = links.filter(([to, , , module]) => {
    if (user?.role === "ADMINISTRADOR") return true;
    if (to === "/perfil" || to === "/ayuda") return true;
    if (user?.role === "SOCIO" && to === "/socios") return false;
    const permissionModule = module || to.slice(1);
    const grants = permissions?.[permissionModule];
    return Boolean(grants?.ver || grants?.consultar);
  });

  const drawer = (
    <Box sx={{ height: "100%", overflowY: "auto", bgcolor: "primary.main", color: "white" }}>
      <Toolbar sx={{ gap: 1 }}>
        <Avatar sx={{ bgcolor: "secondary.main", color: "primary.main" }}>NL</Avatar>
        <Typography fontWeight={800}>Natillera Lili</Typography>
      </Toolbar>
      <List sx={{ px: 1 }}>
        {visibleLinks.map(([to, label, icon]) => (
          <ListItemButton component={NavLink} to={to} key={to} onClick={() => setOpen(false)}
            sx={{ borderRadius: 2, mb: 0.5, color: "inherit", "&.active": { bgcolor: "rgba(255,255,255,.16)" } }}>
            <ListItemIcon sx={{ color: "inherit", minWidth: 42 }}>{icon}</ListItemIcon>
            <ListItemText primary={label} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: "flex" }}>
      <AppBar position="fixed" sx={{ width: { md: `calc(100% - ${width}px)` }, ml: { md: `${width}px` }, bgcolor: "white", color: "text.primary" }} elevation={1}>
        <Toolbar>
          <IconButton sx={{ display: { md: "none" }, mr: 1 }} onClick={() => setOpen(true)}><MenuIcon /></IconButton>
          <Box sx={{ flexGrow: 1 }} />
          <Typography variant="body2" sx={{ mr: 2 }}>{user?.email}</Typography>
          <IconButton onClick={() => { logout(); navigate("/login"); }} aria-label="Cerrar sesión"><LogoutIcon /></IconButton>
        </Toolbar>
      </AppBar>
      <Box component="nav" sx={{ width: { md: width }, flexShrink: { md: 0 } }}>
        <Drawer variant="temporary" open={open} onClose={() => setOpen(false)} sx={{ display: { xs: "block", md: "none" }, "& .MuiDrawer-paper": { width } }}>{drawer}</Drawer>
        <Drawer variant="permanent" open sx={{ display: { xs: "none", md: "block" }, "& .MuiDrawer-paper": { width, border: 0 } }}>{drawer}</Drawer>
      </Box>
      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 3 }, mt: 8, minWidth: 0 }}>
        <Outlet context={{ permissions, permissionsError, retryPermissions: () => setPermissionsVersion((version) => version + 1) }} />
      </Box>
    </Box>
  );
}
