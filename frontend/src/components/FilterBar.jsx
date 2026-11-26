import { Box, Button, MenuItem, TextField } from "@mui/material";

export default function FilterBar({ filters, value, onChange, onClear }) {
  const active = Object.values(value || {}).some((item) => item !== "");

  return (
    <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap", alignItems: "center" }}>
      {filters.map((filter) => (
        <TextField
          key={filter.name}
          select={Boolean(filter.options)}
          size="small"
          label={filter.label}
          type={filter.type || "text"}
          value={value[filter.name] ?? ""}
          onChange={(event) => onChange(filter.name, event.target.value)}
          sx={{ minWidth: filter.width || (filter.type === "date" ? 180 : 220) }}
          InputLabelProps={filter.type === "date" ? { shrink: true } : undefined}
        >
          {filter.options?.map((option) => (
            <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
          ))}
        </TextField>
      ))}
      <Button variant="outlined" disabled={!active} onClick={onClear}>Limpiar filtros</Button>
    </Box>
  );
}
