BEGIN;

CREATE SEQUENCE IF NOT EXISTS telefonos_manual_id_seq
  AS INTEGER
  INCREMENT BY -1
  MINVALUE -2147483648
  MAXVALUE -1
  START WITH -1
  NO CYCLE;

ALTER SEQUENCE telefonos_manual_id_seq
  OWNED BY telefonos.id_phone;

ALTER TABLE telefonos
  ALTER COLUMN id_phone
  SET DEFAULT nextval('telefonos_manual_id_seq');

CREATE INDEX IF NOT EXISTS idx_telefonos_idc
  ON telefonos(idc);

ALTER TABLE garantias
  DROP CONSTRAINT IF EXISTS garantias_pkey;

ALTER TABLE garantias
  ADD CONSTRAINT garantias_pkey
  PRIMARY KEY (gar_codigo, idc);

CREATE INDEX IF NOT EXISTS idx_garantias_idc
  ON garantias(idc);

COMMIT;