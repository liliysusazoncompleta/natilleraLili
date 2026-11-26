import React from "react";
import ReactDOM from "react-dom/client";
import { Alert, CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { BrowserRouter, HashRouter } from "react-router-dom";
import App from "./App";
import { apiConfig } from "./api";

const Router = import.meta.env.VITE_GITHUB_PAGES === "true" ? HashRouter : BrowserRouter;

const theme = createTheme({
  palette: {
    primary: { main: "#12372A" },
    secondary: { main: "#D4A72C" },
    background: { default: "#F4F7F5" }
  },
  typography: { fontFamily: '"Inter", "Segoe UI", Arial, sans-serif', h4: { fontWeight: 800 } },
  shape: { borderRadius: 12 }
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router basename={import.meta.env.VITE_GITHUB_PAGES === "true" ? undefined : import.meta.env.BASE_URL}>
        {apiConfig.error && <Alert severity="error">{apiConfig.error}</Alert>}
        <App />
      </Router>
    </ThemeProvider>
  </React.StrictMode>
);
