# Modelo ER

```mermaid
erDiagram
  usuario ||--o| socio : vincula
  usuario ||--o{ token_actualizacion : posee
  vigencia ||--o{ socio : agrupa
  socio ||--o{ ahorro : aporta
  vigencia ||--o{ ahorro : contiene
  vigencia ||--o{ actividad : contiene
  actividad ||--o{ actividad_participante : incluye
  socio ||--o{ actividad_participante : participa
  socio o|--o{ prestamo : solicita
  vigencia ||--o{ prestamo : contiene
  prestamo ||--o{ pago_prestamo : registra
  vigencia ||--o{ rifa : contiene
  socio o|--o{ rifa : gana
  socio ||--o{ deuda : tiene
  vigencia ||--o{ deuda : contiene
  vigencia ||--o{ liquidacion : genera
  socio ||--o{ liquidacion : recibe
  usuario ||--o{ auditoria : registra
```

Consulte `backend/prisma/schema.prisma` para tipos, PK, FK, UNIQUE, CHECK implícitos e índices.

La cartera vigente se deriva de `prestamo` y `pago_prestamo`; la tabla `deuda` se conserva únicamente por compatibilidad con datos históricos y ya no es la fuente de las deudas mostradas por la aplicación.
