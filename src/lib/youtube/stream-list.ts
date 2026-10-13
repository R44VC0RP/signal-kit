import path from "path";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import type { YouTubeLiveChatMessage } from "./api";

/**
 * liveChatMessages.streamList: YouTube pushes chat over a server-streamed gRPC call instead of
 * us polling liveChatMessages.list. The first response carries recent history; resuming with
 * the last `nextPageToken` continues without gaps or repeats.
 */

const HOST = "youtube.googleapis.com:443";
const PROTO = path.join(process.cwd(), "src/lib/youtube/stream_list.proto");

export type StreamListResponse = {
  offlineAt?: string;
  nextPageToken?: string;
  items?: YouTubeLiveChatMessage[];
};

type StreamCall = grpc.ClientReadableStream<StreamListResponse>;
type Client = grpc.Client & {
  StreamList(request: Record<string, unknown>, metadata: grpc.Metadata): StreamCall;
};

let client: Client | null = null;

function getClient(): Client {
  if (client) {
    return client;
  }
  const definition = protoLoader.loadSync(PROTO, { keepCase: false, longs: String, enums: String, defaults: false, oneofs: true });
  const loaded = grpc.loadPackageDefinition(definition) as unknown as {
    youtube: { api: { v3: { V3DataLiveChatMessageService: new (host: string, credentials: grpc.ChannelCredentials, options?: object) => Client } } };
  };
  client = new loaded.youtube.api.v3.V3DataLiveChatMessageService(HOST, grpc.credentials.createSsl(), {
    "grpc.keepalive_time_ms": 60_000,
    "grpc.keepalive_timeout_ms": 20_000,
  });
  return client;
}

export function openLiveChatStream(input: {
  accessToken: string;
  liveChatId: string;
  pageToken?: string;
  onResponse: (response: StreamListResponse) => void;
  onError: (error: grpc.ServiceError) => void;
  onEnd: () => void;
}) {
  const metadata = new grpc.Metadata();
  metadata.add("authorization", `Bearer ${input.accessToken}`);
  const call = getClient().StreamList(
    {
      liveChatId: input.liveChatId,
      pageToken: input.pageToken,
      part: ["id", "snippet", "authorDetails"],
      profileImageSize: 88,
    },
    metadata,
  );
  let ended = false;
  call.on("data", (response: StreamListResponse) => input.onResponse(restify(response)));
  call.on("error", (error: grpc.ServiceError) => {
    ended = true;
    input.onError(error);
  });
  call.on("end", () => {
    if (!ended) {
      ended = true;
      input.onEnd();
    }
  });
  return {
    cancel() {
      ended = true;
      call.cancel();
    },
  };
}

export const GrpcStatus = grpc.status;

/** gRPC enums come back as TEXT_MESSAGE_EVENT; the REST API (and our normalizer) uses textMessageEvent. */
function restify(response: StreamListResponse): StreamListResponse {
  for (const item of response.items ?? []) {
    const snippet = item.snippet as { type?: string } | undefined;
    if (snippet?.type) {
      snippet.type = snippet.type.toLowerCase().replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
    }
  }
  return response;
}
