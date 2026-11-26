import { useEffect, useState } from "react";
import {
  Alert, Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import { api } from "../api";

const money = (value) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 2 }).format(Number(value));
const name = (member) => [member?.firstName, member?.lastName].filter(Boolean).join(" ");
const emptyForm = () => ({ productId: "", quantity: "1", initialPayment: "0", memberId: "" });
const emptyProduct = () => ({ name: "", unitCost: "0", unitPrice: "0" });

export default function ActivitySales({ activity, isAdmin, onClose, onChanged }) {
  const [sales, setSales] = useState([]);
  const [members, setMembers] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [editingProduct, setEditingProduct] = useState(null);
  const [paymentTarget, setPaymentTarget] = useState(null);
  const [payment, setPayment] = useState({ amount: "", observations: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const selectedProduct = products.find((product) => product.id === form.productId);
  const editingSale = sales.find((sale) => sale.id === editing);
  const price = editingSale ? Number(editingSale.unitPrice) : Number(selectedProduct?.unitPrice || 0);
  const quantity = Number(form.quantity);
  const acquired = Number.isSafeInteger(quantity) && quantity > 0 ? quantity * price : 0;

  async function loadSales() {
    const { data } = await api.get(`/actividades/${activity.id}/ventas`);
    setSales(data.items);
  }

  async function loadProducts() {
    const { data } = await api.get(`/actividades/${activity.id}/productos`);
    setProducts(data.items);
  }

  useEffect(() => {
    async function load() {
      try {
        await loadSales();
        if (isAdmin) {
          await loadProducts();
          const all = [];
          let page = 1;
          let total;
          do {
            const { data } = await api.get("/socios", { params: { vigenciaId: activity.vigenciaId, status: "ACTIVO", page, pageSize: 100 } });
            all.push(...data.items);
            total = data.total;
            page += 1;
          } while (all.length < total);
          setMembers(all);
        }
      } catch (err) {
        setError(err.response?.data?.error || "No fue posible cargar las ventas");
      }
    }
    load();
  }, [activity.id, activity.vigenciaId, isAdmin]);

  async function saveSale(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = { ...form, quantity: Number(form.quantity), initialPayment: Number(form.initialPayment) };
      if (editing) await api.put(`/actividades/${activity.id}/ventas/${editing}`, payload);
      else await api.post(`/actividades/${activity.id}/ventas`, payload);
      setEditing(null);
      setForm(emptyForm());
      await loadSales();
      await onChanged();
    } catch (err) {
      setError(err.response?.data?.error || "No fue posible guardar la venta");
    } finally { setSaving(false); }
  }

  async function saveProduct(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = { ...productForm, unitCost: Number(productForm.unitCost), unitPrice: Number(productForm.unitPrice) };
      if (editingProduct) await api.put(`/actividades/${activity.id}/productos/${editingProduct}`, payload);
      else await api.post(`/actividades/${activity.id}/productos`, payload);
      setEditingProduct(null);
      setProductForm(emptyProduct());
      await loadProducts();
    } catch (err) {
      setError(err.response?.data?.error || "No fue posible guardar el producto");
    } finally { setSaving(false); }
  }

  async function removeSale(sale) {
    if (!window.confirm(`¿Eliminar la venta de "${sale.product}"?`)) return;
    setError("");
    setSaving(true);
    try {
      await api.delete(`/actividades/${activity.id}/ventas/${sale.id}`);
      if (editing === sale.id) { setEditing(null); setForm(emptyForm()); }
      await loadSales();
      await onChanged();
    } catch (err) {
      setError(err.response?.data?.error || "No fue posible eliminar la venta");
    } finally { setSaving(false); }
  }

  async function savePayment(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.post(`/actividades/${activity.id}/ventas/${paymentTarget.id}/abonos`, { amount: Number(payment.amount), observations: payment.observations });
      setPaymentTarget(null);
      await loadSales();
    } catch (err) {
      setError(err.response?.data?.error || "No fue posible registrar el abono");
    } finally { setSaving(false); }
  }

  function editSale(sale) {
    setEditing(sale.id);
    setForm({ productId: "", quantity: String(sale.quantity), initialPayment: "0", memberId: sale.memberId });
  }

  return (
    <Dialog open onClose={() => !saving && onClose()} fullWidth maxWidth="lg">
      <DialogTitle>Ventas: {activity.name}</DialogTitle>
      <DialogContent sx={{ display: "grid", gap: 2, pt: "16px !important" }}>
        {error && <Alert severity="error">{error}</Alert>}
        {isAdmin && activity.vigencia?.status === "ABIERTA" && (
          <Box component="form" onSubmit={saveSale} sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 2 }}>
            {editing ? <TextField label="Socio comprador" value={name(sales.find((sale) => sale.id === editing)?.member)} disabled /> : <Autocomplete
              options={members}
              value={members.find((member) => member.id === form.memberId) || null}
              onChange={(_event, member) => setForm((current) => ({ ...current, memberId: member?.id || "" }))}
              getOptionLabel={name}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderInput={(params) => <TextField {...params} required label="Socio comprador" />}
            />}
            {editing ? <TextField label="Producto" value={editingSale?.product || ""} disabled /> : <Autocomplete
              options={products}
              value={selectedProduct || null}
              onChange={(_event, product) => setForm((current) => ({ ...current, productId: product?.id || "" }))}
              getOptionLabel={(product) => `${product.name} — ${money(product.unitPrice)}`}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderInput={(params) => <TextField {...params} required label="Producto" />}
            />}
            <TextField required type="number" label="Cantidad" inputProps={{ min: 1, step: 1 }} value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
            <TextField label="Valor adquirido" value={money(acquired)} InputProps={{ readOnly: true }} />
            {!editing && <TextField required type="number" label="Abono inicial" inputProps={{ min: 0, step: "0.01" }} value={form.initialPayment} onChange={(event) => setForm({ ...form, initialPayment: event.target.value })} />}
            <Button type="submit" variant="contained" disabled={saving}>{editing ? "Guardar cambios" : "Registrar venta"}</Button>
            {editing && <Button onClick={() => { setEditing(null); setForm(emptyForm()); }}>Cancelar edición</Button>}
          </Box>
        )}
        {isAdmin && activity.vigencia?.status === "ABIERTA" && (
          <Button onClick={() => { setError(""); setCatalogOpen(true); }} sx={{ justifySelf: "start" }}>Administrar productos</Button>
        )}
        <Typography variant="caption" color="text.secondary">Los ingresos y costos de estas ventas se suman automáticamente a los valores generales de la actividad. No los registre nuevamente en esos campos.</Typography>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>{["Comprador", "Producto", "Cantidad", "Costo unitario", "Precio unitario", "Costo total", "Total vendido", "Abonado", "Saldo", "Acciones"].map((label) => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {sales.map((sale) => <TableRow key={sale.id}>
                <TableCell>{name(sale.member)}</TableCell><TableCell>{sale.product}</TableCell><TableCell>{sale.quantity}</TableCell>
                <TableCell>{money(sale.unitCost)}</TableCell><TableCell>{money(sale.unitPrice)}</TableCell><TableCell>{money(sale.totalCost)}</TableCell>
                <TableCell>{money(sale.amountDue)}</TableCell><TableCell>{money(sale.amountPaid)}</TableCell><TableCell>{money(sale.balance)}</TableCell>
                <TableCell>
                  <Button size="small" onClick={() => { setPaymentTarget(sale); setPayment({ amount: "", observations: "" }); }}>Abonos ({sale.payments.length})</Button>
                  {isAdmin && activity.vigencia?.status === "ABIERTA" && <Button size="small" onClick={() => editSale(sale)}>Editar</Button>}
                  {isAdmin && activity.vigencia?.status === "ABIERTA" && !sale.payments.length && <Button size="small" color="error" onClick={() => removeSale(sale)}>Eliminar</Button>}
                </TableCell>
              </TableRow>)}
              {!sales.length && <TableRow><TableCell colSpan={10}>No hay ventas registradas.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Box>
        {paymentTarget && (
          <Box component="form" onSubmit={savePayment} sx={{ display: "grid", gap: 2 }}>
            <Typography variant="subtitle1">Abonos: {paymentTarget.product} — {name(paymentTarget.member)} (saldo {money(paymentTarget.balance)})</Typography>
            {paymentTarget.payments.length ? paymentTarget.payments.map((entry) => (
              <Typography key={entry.id} variant="body2">{new Date(entry.paidAt).toLocaleDateString("es-CO")} · {money(entry.amount)} · {entry.observations || "Sin observaciones"} · {name(entry.recordedBy)}</Typography>
            )) : <Typography variant="body2">Sin abonos.</Typography>}
            {isAdmin && paymentTarget.balance > 0 && <>
              <TextField required type="number" label="Valor del abono" inputProps={{ min: 0.01, max: paymentTarget.balance, step: "0.01" }} value={payment.amount} onChange={(event) => setPayment({ ...payment, amount: event.target.value })} />
              <TextField label="Observaciones" value={payment.observations} onChange={(event) => setPayment({ ...payment, observations: event.target.value })} />
              <Button type="submit" variant="contained" disabled={saving}>Registrar abono</Button>
            </>}
            <Button onClick={() => setPaymentTarget(null)}>Cerrar abonos</Button>
          </Box>
        )}
      </DialogContent>
      <DialogActions><Button onClick={onClose} disabled={saving}>Cerrar</Button></DialogActions>
      <Dialog open={catalogOpen} onClose={() => !saving && setCatalogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Productos de {activity.name}</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 2, pt: "16px !important" }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Typography variant="body2">Los cambios de precio o costo se aplican solo a ventas futuras.</Typography>
          <Box component="form" onSubmit={saveProduct} sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 2 }}>
            <TextField required label="Producto" inputProps={{ maxLength: 200 }} value={productForm.name} onChange={(event) => setProductForm((current) => ({ ...current, name: event.target.value }))} />
            <TextField required type="number" label="Costo unitario" inputProps={{ min: 0, step: "0.01" }} value={productForm.unitCost} onChange={(event) => setProductForm((current) => ({ ...current, unitCost: event.target.value }))} />
            <TextField required type="number" label="Precio unitario de venta" inputProps={{ min: 0, step: "0.01" }} value={productForm.unitPrice} onChange={(event) => setProductForm((current) => ({ ...current, unitPrice: event.target.value }))} />
            <Button type="submit" variant="contained" disabled={saving}>{editingProduct ? "Guardar cambios" : "Registrar producto"}</Button>
            {editingProduct && <Button onClick={() => { setEditingProduct(null); setProductForm(emptyProduct()); }}>Cancelar edición</Button>}
          </Box>
          <Table size="small">
            <TableHead><TableRow><TableCell>Producto</TableCell><TableCell>Costo unitario</TableCell><TableCell>Precio unitario</TableCell><TableCell>Acciones</TableCell></TableRow></TableHead>
            <TableBody>
              {products.map((product) => <TableRow key={product.id}>
                <TableCell>{product.name}</TableCell><TableCell>{money(product.unitCost)}</TableCell><TableCell>{money(product.unitPrice)}</TableCell>
                <TableCell><Button size="small" onClick={() => { setEditingProduct(product.id); setProductForm({ name: product.name, unitCost: String(product.unitCost), unitPrice: String(product.unitPrice) }); }}>Modificar</Button></TableCell>
              </TableRow>)}
              {!products.length && <TableRow><TableCell colSpan={4}>No hay productos registrados para esta actividad.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </DialogContent>
        <DialogActions><Button onClick={() => { setCatalogOpen(false); setError(""); }} disabled={saving}>Cerrar</Button></DialogActions>
      </Dialog>
    </Dialog>
  );
}
