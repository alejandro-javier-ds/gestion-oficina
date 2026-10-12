export class ErrorWhatsapp extends Error {
  constructor(
    public readonly codigo: string,
    mensaje: string,
    public readonly status = 503,
  ) {
    super(mensaje);
    this.name = "ErrorWhatsapp";
  }
}
