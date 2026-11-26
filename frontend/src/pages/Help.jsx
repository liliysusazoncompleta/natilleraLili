import { useEffect, useRef, useState } from "react";
import { Link as RouterLink, useOutletContext } from "react-router-dom";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Divider, Grid,
  Paper, Stack, TextField, Typography
} from "@mui/material";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import SearchIcon from "@mui/icons-material/Search";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { useAuthStore } from "../store";
import { searchGuides, visibleGuides } from "../help.mjs";

function ExampleScreen({ guide }) {
  return (
    <Box component="figure" sx={{ m: 0 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Pantalla ilustrativa: {guide.screen}</Typography>
      <Paper variant="outlined" sx={{ overflow: "hidden", bgcolor: "grey.50" }}>
        <Box sx={{ bgcolor: "primary.main", color: "white", px: 2, py: 1, display: "flex", gap: 1, alignItems: "center" }}>
          <Typography aria-hidden="true">● ● ●</Typography>
          <Typography variant="caption">Natillera Lili · Ejemplo</Typography>
        </Box>
        <Box sx={{ p: 2, display: "grid", gap: 1 }}>
          <Typography fontWeight={700}>{guide.example[0]}</Typography>
          {guide.example.slice(1).map((item, index) => (
            <Box key={item} sx={{
              border: 1, borderColor: index === 0 ? "primary.light" : "grey.300",
              borderRadius: 1, px: 1.5, py: 1, bgcolor: index === 0 ? "white" : "grey.100",
              color: "text.secondary", fontSize: "0.875rem"
            }}>{item}</Box>
          ))}
        </Box>
      </Paper>
      <Typography component="figcaption" variant="caption" color="text.secondary">
        Ilustración de referencia, no interactiva y sin datos reales. La pantalla puede variar según sus permisos.
      </Typography>
    </Box>
  );
}

export default function Help() {
  const user = useAuthStore((state) => state.user);
  const { permissions, permissionsError, retryPermissions } = useOutletContext();
  const [question, setQuestion] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const answerRef = useRef(null);
  const guides = visibleGuides(user?.role, permissions);
  const results = submitted ? searchGuides(guides, submitted) : guides;
  const selected = guides.find((guide) => guide.id === selectedId);

  useEffect(() => {
    if (selected) answerRef.current?.focus();
  }, [selectedId, selected]);

  function search(event) {
    event.preventDefault();
    setSubmitted(question.trim());
    setSelectedId("");
  }

  function chooseGuide(guide) {
    setSelectedId(guide.id);
  }

  return (
    <Box>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
        <HelpOutlineIcon color="primary" fontSize="large" />
        <Typography variant="h4" component="h1">Centro de ayuda</Typography>
      </Stack>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Escriba una pregunta o elija una guía para aprender a usar la aplicación.
        Esta ayuda busca en guías preparadas; no utiliza inteligencia artificial ni envía su pregunta a servicios externos.
      </Typography>
      {permissionsError && user?.role !== "ADMINISTRADOR" && (
        <Alert severity="warning" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={retryPermissions}>Reintentar</Button>}>
          {permissionsError} Mientras tanto solo se muestran guías generales.
        </Alert>
      )}
      {!permissions && !permissionsError && user?.role !== "ADMINISTRADOR" && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
          <CircularProgress size={18} /><Typography variant="body2">Cargando sus permisos...</Typography>
        </Stack>
      )}
      <Paper component="form" onSubmit={search} variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <TextField
            fullWidth label="¿En qué podemos ayudarle?"
            placeholder="Ejemplo: ¿cómo consulto mis deudas?"
            value={question} onChange={(event) => setQuestion(event.target.value)}
            inputProps={{ maxLength: 300 }}
          />
          <Button type="submit" variant="contained" startIcon={<SearchIcon />} disabled={!question.trim()}>Buscar respuesta</Button>
          {submitted && <Button onClick={() => { setQuestion(""); setSubmitted(""); setSelectedId(""); }}>Ver todas</Button>}
        </Stack>
        <Typography variant="caption" color="text.secondary">No escriba contraseñas ni información personal en su pregunta.</Typography>
      </Paper>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
            {submitted ? "Guías relacionadas" : "Preguntas frecuentes"}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {submitted ? `Resultados para: ${submitted}` : "Seleccione una pregunta para ver los pasos y una pantalla de ejemplo."}
          </Typography>
          <Box aria-live="polite">
            {!results.length && (
              <Alert severity="info">
                No encontré una guía para esa pregunta entre las disponibles. Pruebe otras palabras o consulte al administrador.
              </Alert>
            )}
            <Stack spacing={1}>
              {results.map((guide) => (
                <Button
                  key={guide.id} variant={selectedId === guide.id ? "contained" : "outlined"}
                  onClick={() => chooseGuide(guide)} aria-pressed={selectedId === guide.id}
                  sx={{ justifyContent: "space-between", textAlign: "left", textTransform: "none", py: 1.2 }}
                  endIcon={<ArrowForwardIcon />}
                >{guide.title}</Button>
              ))}
            </Stack>
          </Box>
        </Grid>
        <Grid size={{ xs: 12, md: 7 }}>
          {selected ? (
            <Card ref={answerRef} tabIndex={-1} variant="outlined" component="section" aria-labelledby="help-answer-title">
              <CardContent>
                <Chip size="small" label={selected.category} sx={{ mb: 1 }} />
                <Typography id="help-answer-title" variant="h5" component="h2" sx={{ mb: 2 }}>{selected.title}</Typography>
                <Typography variant="subtitle1" fontWeight={700}>Paso a paso</Typography>
                <Box component="ol" sx={{ pl: 3, mb: 2 }}>
                  {selected.steps.map((step) => <Box component="li" key={step} sx={{ mb: 1 }}><Typography>{step}</Typography></Box>)}
                </Box>
                {selected.note && <Alert severity="info" sx={{ mb: 2 }}>{selected.note}</Alert>}
                <Divider sx={{ my: 2 }} />
                <ExampleScreen guide={selected} />
                {selected.path && (
                  <Button component={RouterLink} to={selected.path} variant="contained" endIcon={<ArrowForwardIcon />} sx={{ mt: 2 }}>
                    Ir a {selected.screen}
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <Paper variant="outlined" sx={{ p: 3, bgcolor: "grey.50" }}>
              <Typography variant="h6">Elija una pregunta</Typography>
              <Typography color="text.secondary">Aquí verá una explicación paso a paso y una ilustración de la pantalla correspondiente.</Typography>
            </Paper>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}
