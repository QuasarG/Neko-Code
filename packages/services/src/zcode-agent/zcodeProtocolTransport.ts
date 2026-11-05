import type { Event, IDisposable } from "@zcode/rpc";
import type { NekodeProtocolMessage } from "@zcode/shared";

export type NekodeProtocolTransportKind = "stdio" | "websocket" | "memory";

export interface NekodeProtocolTransportClosedEvent {
  code?: number | null;
  signal?: NodeJS.Signals | null;
  reason?: string;
}

export interface NekodeProtocolTransport extends IDisposable {
  readonly kind: NekodeProtocolTransportKind;
  readonly onMessage: Event<NekodeProtocolMessage>;
  readonly onClose: Event<NekodeProtocolTransportClosedEvent>;
  send(message: NekodeProtocolMessage): Promise<void>;
  disposeAndWait?(): Promise<void>;
}
