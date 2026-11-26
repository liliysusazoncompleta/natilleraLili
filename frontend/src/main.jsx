import React from "react";
import ReactDOM from "react-dom/client";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { BrowserRouter } from "react-router-dom";
import App from "./App";

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
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);
