import { createClient } from "@connectrpc/connect";

import { AgentService } from "@/gen/lemma/v1/agent_pb";
import { ProviderService } from "@/gen/lemma/v1/provider_pb";
import { SessionService } from "@/gen/lemma/v1/session_pb";

import { transport } from "./transport";

export const agentClient = createClient(AgentService, transport);
export const sessionClient = createClient(SessionService, transport);
export const providerClient = createClient(ProviderService, transport);
