import type { WebSocket } from "ws";
import type { KeyObject, X509Certificate } from "node:crypto";
export type ActorWhatsapp = { userId: number; rol: string; debeCambiarContrasena: boolean; campanaLeaseId?: string };
export type OperacionWhatsapp = { op: string; numero?: string; payload: Record<string, unknown> };
export class ErrorRemotoWhatsapp extends Error { codigo: string; status: number; constructor(codigo: string, mensaje: string, status?: number); }
export const UUID: RegExp;
export const OPERACIONES: Set<string>;
export const CABECERAS_PRIVADAS: Record<string, string>;
export function modoWhatsapp(): "local" | "remote";
export function validarActor(actor: ActorWhatsapp | undefined, op: string): void;
export function validarOperacion(entrada: unknown): OperacionWhatsapp;
export function firmarOperacion(entrada: OperacionWhatsapp, actor: ActorWhatsapp, key: KeyObject, ahora?: number): { cuerpo: string; headers: Record<string, string> };
export function verificarOperacion(cuerpo: string, headers: Record<string, unknown>, certificado: X509Certificate, nonces: Map<string, number>, ahora?: number): { entrada: OperacionWhatsapp; actor: ActorWhatsapp };
export function crearClienteWhatsapp(env?: NodeJS.ProcessEnv): { operar(entrada: OperacionWhatsapp, actor: ActorWhatsapp, timeout?: number): Promise<unknown>; abrirVisor(numero: string, id: string, actor: ActorWhatsapp): Promise<WebSocket>; cerrar(): void };
