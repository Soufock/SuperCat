import type GMApi from "./gm_api";
import type { MessageConnect, TMessage } from "@Packages/message/types";
import { dataEncode, dataDecode } from "@App/pkg/utils/xhr/xhr_data";
import { randomMessageFlag } from "@App/pkg/utils/utils";

type GMWebSocketEventType = "open" | "message" | "error" | "close";

type GMWebSocketEventMap = {
  open: GMTypes.WebSocketEvent;
  message: GMTypes.WebSocketMessageEvent;
  error: GMTypes.WebSocketErrorEvent;
  close: GMTypes.WebSocketCloseEvent;
};

type WebSocketConnectRequest = {
  id: string;
  url: string;
  protocols?: string | string[];
  binaryType?: BinaryType;
};

type WebSocketServerEvent =
  | {
      id: string;
      type: "open";
      protocol: string;
      extensions: string;
      readyState: number;
      url: string;
    }
  | {
      id: string;
      type: "message";
      data: any;
      readyState: number;
      origin: string;
    }
  | {
      id: string;
      type: "error";
      error: string;
      readyState: number;
    }
  | {
      id: string;
      type: "close";
      code: number;
      reason: string;
      wasClean: boolean;
      readyState: number;
    };

const bindTarget = <T extends object>(event: T, target: GMWebSocketProxy): T => {
  Object.defineProperties(event, {
    currentTarget: {
      value: target,
      enumerable: true,
      configurable: true,
    },
    target: {
      value: target,
      enumerable: true,
      configurable: true,
    },
  });
  return event;
};

const createOpenEvent = (target: GMWebSocketProxy, extra: Omit<GMTypes.WebSocketEvent, "type"> = {}) =>
  bindTarget(
    {
      type: "open" as const,
      ...extra,
    },
    target
  );

const createMessageEvent = (target: GMWebSocketProxy, extra: Omit<GMTypes.WebSocketMessageEvent, "type">) =>
  bindTarget(
    {
      type: "message" as const,
      ...extra,
    },
    target
  );

const createErrorEvent = (target: GMWebSocketProxy, extra: Omit<GMTypes.WebSocketErrorEvent, "type"> = {}) =>
  bindTarget(
    {
      type: "error" as const,
      ...extra,
    },
    target
  );

const createCloseEvent = (target: GMWebSocketProxy, extra: Omit<GMTypes.WebSocketCloseEvent, "type">) =>
  bindTarget(
    {
      type: "close" as const,
      ...extra,
    },
    target
  );

class GMWebSocketProxy implements GMTypes.GMWebSocket {
  private readonly socketId = randomMessageFlag();

  public readonly CONNECTING = 0;

  public readonly OPEN = 1;

  public readonly CLOSING = 2;

  public readonly CLOSED = 3;

  public readyState: number = WebSocket.CONNECTING;

  public bufferedAmount = 0;

  public extensions = "";

  public protocol = "";

  public url: string;

  public onopen: ((event: GMTypes.WebSocketEvent) => unknown) | null = null;

  public onmessage: ((event: GMTypes.WebSocketMessageEvent) => unknown) | null = null;

  public onerror: ((event: GMTypes.WebSocketErrorEvent) => unknown) | null = null;

  public onclose: ((event: GMTypes.WebSocketCloseEvent) => unknown) | null = null;

  private connect: MessageConnect | null = null;

  private connectReady = false;

  private listenerMap = new Map<GMWebSocketEventType, Set<(event: any) => unknown>>();

  private pendingActions: Array<() => void> = [];

  private context: unknown;

  private binaryTypeValue: BinaryType;

  constructor(
    private readonly a: GMApi,
    details: GMTypes.WebSocketDetails
  ) {
    this.url = `${details.url}`;
    this.context = details.context;
    this.binaryTypeValue = details.binaryType || "blob";
    this.onopen = details.onopen || null;
    this.onmessage = details.onmessage || null;
    this.onerror = details.onerror || null;
    this.onclose = details.onclose || null;
    this.init(details);
  }

  get binaryType() {
    return this.binaryTypeValue;
  }

  set binaryType(value: BinaryType) {
    const next = value === "arraybuffer" ? "arraybuffer" : "blob";
    this.binaryTypeValue = next;
    this.enqueueAction(() => {
      this.connect?.sendMessage({
        action: "set_binary_type",
        data: { id: this.socketId, binaryType: next },
      });
    });
  }

  addEventListener(
    type: GMTypes.WebSocketEvent["type"],
    listener: (
      event:
        | GMTypes.WebSocketEvent
        | GMTypes.WebSocketMessageEvent
        | GMTypes.WebSocketCloseEvent
        | GMTypes.WebSocketErrorEvent
    ) => unknown
  ) {
    let listeners = this.listenerMap.get(type);
    if (!listeners) {
      listeners = new Set();
      this.listenerMap.set(type, listeners);
    }
    listeners.add(listener as (event: any) => unknown);
  }

  removeEventListener(
    type: GMTypes.WebSocketEvent["type"],
    listener: (
      event:
        | GMTypes.WebSocketEvent
        | GMTypes.WebSocketMessageEvent
        | GMTypes.WebSocketCloseEvent
        | GMTypes.WebSocketErrorEvent
    ) => unknown
  ) {
    this.listenerMap.get(type)?.delete(listener as (event: any) => unknown);
  }

  send(data: string | Blob | ArrayBuffer | ArrayBufferView) {
    if (this.readyState !== WebSocket.OPEN) {
      throw new Error("GM_webSocket: WebSocket is not open");
    }
    void dataEncode(data).then((encoded) => {
      if (this.readyState !== WebSocket.OPEN) return;
      this.enqueueAction(() => {
        this.connect?.sendMessage({
          action: "send",
          data: { id: this.socketId, data: encoded },
        });
      });
    });
  }

  close(code?: number, reason?: string) {
    if (this.readyState === WebSocket.CLOSING || this.readyState === WebSocket.CLOSED) return;
    this.readyState = WebSocket.CLOSING;
    this.enqueueAction(() => {
      this.connect?.sendMessage({
        action: "close",
        data: { id: this.socketId, code, reason },
      });
    });
  }

  private enqueueAction(action: () => void) {
    if (this.connectReady) {
      action();
      return;
    }
    this.pendingActions.push(action);
  }

  private flushPendingActions() {
    const actions = this.pendingActions.splice(0);
    for (const action of actions) {
      action();
    }
  }

  private dispatchEvent<T extends GMWebSocketEventType>(type: T, event: GMWebSocketEventMap[T]) {
    const handler = this[`on${type}` as "onopen" | "onmessage" | "onerror" | "onclose"];
    handler?.(event as never);
    this.listenerMap.get(type)?.forEach((listener) => {
      listener(event);
    });
  }

  private makeEventContext<T extends { context?: unknown }>(event: T): T {
    if (typeof this.context === "undefined") {
      return event;
    }
    return {
      ...event,
      context: this.context,
    } as T;
  }

  private async handleServerEvent(data: WebSocketServerEvent) {
    if (typeof data.id === "string" && data.id !== this.socketId) return;
    switch (data.type) {
      case "open": {
        this.readyState = data.readyState;
        this.protocol = data.protocol;
        this.extensions = data.extensions;
        this.url = data.url;
        this.dispatchEvent(
          "open",
          this.makeEventContext(
            createOpenEvent(this, {
              extensions: data.extensions,
              protocol: data.protocol,
              url: data.url,
            })
          )
        );
        return;
      }
      case "message": {
        const decoded = await dataDecode(data.data);
        let messageData = decoded;
        if (decoded instanceof Blob) {
          messageData = this.binaryType === "arraybuffer" ? await decoded.arrayBuffer() : decoded;
        }
        this.dispatchEvent(
          "message",
          this.makeEventContext(
            createMessageEvent(this, {
              data: messageData,
              origin: data.origin,
            })
          )
        );
        return;
      }
      case "error": {
        this.readyState = data.readyState;
        this.dispatchEvent(
          "error",
          this.makeEventContext(
            createErrorEvent(this, {
              error: data.error,
              message: data.error,
            })
          )
        );
        return;
      }
      case "close": {
        this.readyState = data.readyState;
        this.dispatchEvent(
          "close",
          this.makeEventContext(
            createCloseEvent(this, {
              code: data.code,
              reason: data.reason,
              wasClean: data.wasClean,
            })
          )
        );
      }
    }
  }

  private init(details: GMTypes.WebSocketDetails) {
    if (this.a.isInvalidContext()) {
      queueMicrotask(() => {
        this.readyState = WebSocket.CLOSED;
        this.dispatchEvent(
          "error",
          this.makeEventContext(createErrorEvent(this, { error: "GM_webSocket: Invalid Context" }))
        );
      });
      return;
    }
    const url = details.url instanceof URL ? details.url.href : `${details.url}`;
    const request: WebSocketConnectRequest = {
      id: this.socketId,
      url,
      protocols: details.protocols,
      binaryType: this.binaryType,
    };
    void this.a
      .connect("GM_webSocket", [request])
      .then((connect) => {
        this.connect = connect;
        this.connectReady = true;
        connect.onMessage((msgData: TMessage<any>) => {
          if ("code" in msgData && msgData.code) {
            this.readyState = WebSocket.CLOSED;
            this.dispatchEvent(
              "error",
              this.makeEventContext(createErrorEvent(this, { error: msgData.message || "Unknown Error" }))
            );
            return;
          }
          if (!("action" in msgData) || !msgData.data) return;
          void this.handleServerEvent(msgData.data as WebSocketServerEvent);
        });
        connect.onDisconnect(() => {
          if (this.readyState !== WebSocket.CLOSED) {
            this.readyState = WebSocket.CLOSED;
          }
        });
        this.flushPendingActions();
      })
      .catch((error) => {
        this.readyState = WebSocket.CLOSED;
        const message = error instanceof Error ? error.message : `${error}`;
        this.dispatchEvent("error", this.makeEventContext(createErrorEvent(this, { error: message })));
        this.dispatchEvent(
          "close",
          this.makeEventContext(
            createCloseEvent(this, {
              code: 1006,
              reason: message,
              wasClean: false,
            })
          )
        );
      });
  }
}

export function GM_webSocket(a: GMApi, details: GMTypes.WebSocketDetails): GMTypes.GMWebSocket {
  return new GMWebSocketProxy(a, details);
}
