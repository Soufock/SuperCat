import type { IGetSender } from "@Packages/message/server";
import type { TMessage } from "@Packages/message/types";
import type { GMApiRequest } from "../types";
import { dataDecode, dataEncode } from "@App/pkg/utils/xhr/xhr_data";

type WebSocketClientMessage =
  | {
      action: "send";
      data: {
        id: string;
        data: any;
      };
    }
  | {
      action: "close";
      data?: {
        id: string;
        code?: number;
        reason?: string;
      };
    }
  | {
      action: "set_binary_type";
      data: {
        id: string;
        binaryType: BinaryType;
      };
    };

const toErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return `${error || "Unknown Error"}`;
};

export async function handleGMWebSocket(
  request: GMApiRequest<[GMSend.WebSocketDetails]>,
  sender: IGetSender
): Promise<void> {
  const msgConn = sender.getConnect();
  if (!msgConn) {
    throw new Error("GM_webSocket ERROR: sender is not MessageConnect");
  }
  const details = request.params[0];
  if (!details) {
    throw new Error("GM_webSocket ERROR: param is failed");
  }
  const socketId = details.id;

  const ws = new WebSocket(details.url, details.protocols);
  ws.binaryType = details.binaryType || "blob";
  let disconnected = false;

  const safeSend = (data: TMessage) => {
    if (disconnected) return false;
    try {
      msgConn.sendMessage(data);
      return true;
    } catch {
      disconnected = true;
      return false;
    }
  };

  const closeSocket = (code?: number, reason?: string) => {
    if (ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED) return;
    ws.close(code, reason);
  };

  ws.addEventListener("open", () => {
    safeSend({
      action: "event",
      data: {
        type: "open",
        id: socketId,
        extensions: ws.extensions,
        protocol: ws.protocol,
        readyState: ws.readyState,
        url: ws.url,
      },
    });
  });

  ws.addEventListener("message", (event) => {
    void (async () => {
      try {
        const data = await dataEncode(event.data);
        safeSend({
          action: "event",
          data: {
            type: "message",
            id: socketId,
            data,
            origin: new URL(ws.url).origin,
            readyState: ws.readyState,
          },
        });
      } catch (error) {
        safeSend({
          action: "event",
          data: {
            type: "error",
            id: socketId,
            error: toErrorMessage(error),
            readyState: ws.readyState,
          },
        });
      }
    })();
  });

  ws.addEventListener("error", () => {
    safeSend({
      action: "event",
      data: {
        type: "error",
        id: socketId,
        error: "WebSocket error",
        readyState: ws.readyState,
      },
    });
  });

  ws.addEventListener("close", (event) => {
    safeSend({
      action: "event",
      data: {
        type: "close",
        id: socketId,
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
        readyState: ws.readyState,
      },
    });
    if (!disconnected) {
      disconnected = true;
      try {
        msgConn.disconnect();
      } catch {
        // ignored
      }
    }
  });

  msgConn.onMessage((message) => {
    if (!("action" in message)) return;
    const clientMessage = message as WebSocketClientMessage;
    if (typeof clientMessage.data?.id === "string" && clientMessage.data.id !== socketId) return;
    switch (clientMessage.action) {
      case "send": {
        void (async () => {
          try {
            const data = await dataDecode(clientMessage.data.data);
            ws.send(await Promise.resolve(data));
          } catch (error) {
            safeSend({
              action: "event",
              data: {
                type: "error",
                id: socketId,
                error: toErrorMessage(error),
                readyState: ws.readyState,
              },
            });
          }
        })();
        break;
      }
      case "close":
        closeSocket(clientMessage.data?.code, clientMessage.data?.reason);
        break;
      case "set_binary_type":
        ws.binaryType = clientMessage.data.binaryType === "arraybuffer" ? "arraybuffer" : "blob";
        break;
    }
  });

  msgConn.onDisconnect(() => {
    disconnected = true;
    closeSocket(1000, "GM_webSocket disconnected");
  });
}
