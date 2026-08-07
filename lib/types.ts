// lib/types.ts
// Define la forma de los datos que viajan entre el backend y el
// frontend, para que TypeScript avise si algo no calza.

export type Cuenta = {
  codcuentacobranza: string;
  idc: string;
  cliente: string;
  expediente: string | null;
  funcionario: string | null;
  gestor: string | null;
  mtodeuda_sol: number | null;
  mtodeudavencida_sol: number | null;

  codmoneda: string | null;
  deudatotal_monedaorigen: number | null;
  deudavencida_monedaorigen: number | null;

  dtp: number | null;
  estado_cartera: string | null;
  etapa_procesal: string | null;
  diasmora: number | null;
  rango_mora: string | null;
  prioridad: string | null;
  segmentacion: string | null;
  descproducto: string | null;
  direccion: string | null;
  distrito: string | null;
  provincia: string | null;
  departamento: string | null;
  router: string | null;
  nivel_riesgo: string | null;
  tipo_juicio: string | null;
  nro_juicio: string | null;
  fec_demanda: string | null;
  supervisor_procesal: string | null;
  analista_procesal: string | null;
  fec_entrega_legajo_a_estudio: string | null;
};

export type Garantia = {
  gar_codigo: string;
  idc: string;
  cliente: string | null;
  tipo_garantia: string | null;
  descripcion: string | null;
  moneda: string | null;
  monto_comercial: number | null;
  monto_afectacion: number | null;
  monto_realizacion: number | null;
  funcionario: string | null;
};

export type Apersonamiento = {
  id: number;
  idc: string;
  codcuentacobranza: string | null;
  cliente: string | null;
  desgrupofuncional: string | null;
  fec_asignacion_lgm: string | null;
  fecha_entrega: string | null;
  motivo: string | null;
  montodeudatotal: number | null;
};
