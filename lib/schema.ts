// lib/schema.ts
// Aquí viven las definiciones de las tablas. Si necesitas agregar
// una columna o una tabla nueva, este es el único archivo que tocas.

export const CREATE_CUENTAS = `
CREATE TABLE IF NOT EXISTS cuentas (
  codcuentacobranza TEXT PRIMARY KEY,
  idc TEXT NOT NULL,
  cliente TEXT NOT NULL,
  expediente TEXT,
  funcionario TEXT,
  gestor TEXT,
  mtodeuda_sol REAL,
  mtodeudavencida_sol REAL,
  dtp REAL,
  estado_cartera TEXT,
  etapa_procesal TEXT,
  diasmora INTEGER,
  rango_mora TEXT,
  prioridad TEXT,
  segmentacion TEXT,
  descproducto TEXT,
  direccion TEXT,
  distrito TEXT,
  provincia TEXT,
  departamento TEXT,
  router TEXT,
  nivel_riesgo TEXT,
  tipo_juicio TEXT,
  nro_juicio TEXT,
  fec_demanda TEXT,
  supervisor_procesal TEXT,
  analista_procesal TEXT,
  fec_entrega_legajo_a_estudio TEXT,
  activo INTEGER NOT NULL DEFAULT 1,
  fecha_ultima_actualizacion TEXT NOT NULL
);
`;

export const CREATE_INDICE_IDC = `
CREATE INDEX IF NOT EXISTS idx_cuentas_idc ON cuentas(idc);
`;

export const CREATE_GESTIONES = `
CREATE TABLE IF NOT EXISTS gestiones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idc TEXT NOT NULL,
  codcuentacobranza TEXT,
  usuario_gestor_oficina TEXT NOT NULL,
  categoria TEXT,
  codigo_razon TEXT,
  segmentacion TEXT,
  telefono TEXT,
  fecha_hora TEXT NOT NULL,
  monto_compromiso REAL,
  monto_pagado REAL,
  moneda_monto_pagado TEXT,
  fecha_promesa TEXT,
  observacion TEXT,
  FOREIGN KEY (codcuentacobranza) REFERENCES cuentas(codcuentacobranza)
);
`;

export const CREATE_INDICE_GESTIONES_IDC = `
CREATE INDEX IF NOT EXISTS idx_gestiones_idc ON gestiones(idc);
`;

export const CREATE_TELEFONOS = `
CREATE TABLE IF NOT EXISTS telefonos (
  id_phone INTEGER PRIMARY KEY,
  idc TEXT NOT NULL,
  cic TEXT,
  phone TEXT NOT NULL,
  tipo_telefono TEXT NOT NULL,
  qtty_phone_ranking REAL,
  creado_por TEXT,
  editado_por TEXT,
  fecha_modificacion TEXT,
  agregado_manualmente INTEGER NOT NULL DEFAULT 0,
  activo INTEGER NOT NULL DEFAULT 1
);
`;

export const CREATE_GARANTIAS = `
CREATE TABLE IF NOT EXISTS garantias (
  gar_codigo TEXT PRIMARY KEY,
  idc TEXT NOT NULL,
  cliente TEXT,
  tipo_garantia TEXT,
  descripcion TEXT,
  moneda TEXT,
  monto_comercial REAL,
  monto_afectacion REAL,
  monto_realizacion REAL,
  funcionario TEXT,
  activo INTEGER NOT NULL DEFAULT 1
);
`;

export const CREATE_INDICE_GARANTIAS_IDC = `
CREATE INDEX IF NOT EXISTS idx_garantias_idc ON garantias(idc);
`;

export const CREATE_APERSONAMIENTO = `
CREATE TABLE IF NOT EXISTS apersonamiento (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idc TEXT NOT NULL,
  codcuentacobranza TEXT,
  cliente TEXT,
  desgrupofuncional TEXT,
  fec_asignacion_lgm TEXT,
  fecha_entrega TEXT,
  motivo TEXT,
  montodeudatotal REAL,
  activo INTEGER NOT NULL DEFAULT 1
);
`;

export const CREATE_INDICE_APERSONAMIENTO_IDC = `
CREATE INDEX IF NOT EXISTS idx_apersonamiento_idc ON apersonamiento(idc);
`;

export const CREATE_PROMESAS_PAGO = `
CREATE TABLE IF NOT EXISTS promesas_pago (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idc TEXT NOT NULL,
  codcuentacobranza TEXT NOT NULL,
  tipo TEXT NOT NULL,
  moneda TEXT NOT NULL,
  monto_deuda_total REAL,
  monto_prometido REAL,
  monto_dolares REAL,
  modalidad_pago TEXT,
  tipo_negociacion TEXT,
  beneficio TEXT,
  status_pdp TEXT,
  status_pago TEXT,
  numero_cuotas_aprobadas INTEGER,
  estudio TEXT,
  matriz TEXT,
  observacion TEXT,
  fecha_promesa TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'vigente',
  usuario_gestor_oficina TEXT NOT NULL,
  fecha_hora TEXT NOT NULL,
  gestion_id INTEGER,
  FOREIGN KEY (codcuentacobranza) REFERENCES cuentas(codcuentacobranza),
  FOREIGN KEY (gestion_id) REFERENCES gestiones(id)
);
`;

export const CREATE_INDICE_PROMESAS_IDC = `
CREATE INDEX IF NOT EXISTS idx_promesas_idc ON promesas_pago(idc);
`;

export const CREATE_CITAS = `
CREATE TABLE IF NOT EXISTS citas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idc TEXT NOT NULL,
  tipo TEXT NOT NULL,
  fecha_cita TEXT NOT NULL,
  observacion TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente',
  usuario_gestor_oficina TEXT NOT NULL,
  fecha_hora TEXT NOT NULL
);
`;

export const CREATE_INDICE_CITAS_IDC = `
CREATE INDEX IF NOT EXISTS idx_citas_idc ON citas(idc);
`;

export const CREATE_HISTORIAL_ROUTER = `
CREATE TABLE IF NOT EXISTS historial_router (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idc TEXT NOT NULL,
  codcuentacobranza TEXT NOT NULL,
  fecha_registro TEXT NOT NULL,
  seguimiento TEXT NOT NULL,
  router TEXT NOT NULL,
  descripcion TEXT
);
`;

export const CREATE_INDICE_HISTORIAL_ROUTER_IDC = `
CREATE INDEX IF NOT EXISTS idx_historial_router_idc ON historial_router(idc);
`;

export const CREATE_IMPORTS = `
CREATE TABLE IF NOT EXISTS imports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre_archivo TEXT NOT NULL,
  fecha_import TEXT NOT NULL,
  cuentas_nuevas INTEGER,
  cuentas_actualizadas INTEGER,
  cuentas_dadas_de_baja INTEGER
);
`;

export const CREATE_USUARIOS = `
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  nombre_completo TEXT NOT NULL,
  email TEXT,
  gestor TEXT,
  rol TEXT NOT NULL DEFAULT 'gestor',
  debe_cambiar_contrasena INTEGER NOT NULL DEFAULT 1,
  intentos_fallidos INTEGER NOT NULL DEFAULT 0,
  bloqueado_hasta TEXT,
  activo INTEGER NOT NULL DEFAULT 1,
  fecha_creacion TEXT NOT NULL
);
`;

export const CREATE_EXPORTACIONES = `
CREATE TABLE IF NOT EXISTS exportaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha_hora TEXT NOT NULL,
  usuario TEXT NOT NULL
);
`;

export const CREATE_DIRECCIONES = `
CREATE TABLE IF NOT EXISTS direcciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idc TEXT NOT NULL,
  direccion TEXT NOT NULL,
  distrito TEXT,
  provincia TEXT,
  departamento TEXT,
  tipo TEXT NOT NULL DEFAULT 'Domicilio',
  fuente TEXT NOT NULL DEFAULT 'portafolio',
  creado_por TEXT,
  editado_por TEXT,
  fecha_modificacion TEXT NOT NULL,
  activo INTEGER NOT NULL DEFAULT 1
);
`;

export const CREATE_INDICE_DIRECCIONES_IDC = `
CREATE INDEX IF NOT EXISTS idx_direcciones_idc ON direcciones(idc);
`;

export const CREATE_WHATSAPP_NUMEROS = `
CREATE TABLE IF NOT EXISTS whatsapp_numeros (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero TEXT NOT NULL UNIQUE,
  propietario TEXT NOT NULL,
  propietario_tipo TEXT NOT NULL DEFAULT 'gestor',
  activo INTEGER NOT NULL DEFAULT 1,
  principal INTEGER NOT NULL DEFAULT 0,
  fecha_creacion TEXT NOT NULL
);
`;

export const CREATE_INDICE_WHATSAPP_NUMEROS = `
CREATE INDEX IF NOT EXISTS idx_whatsapp_numeros_activo
ON whatsapp_numeros(activo);
`;
