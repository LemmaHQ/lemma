import { createClient } from "@connectrpc/connect";

import { AgentService } from "@/gen/lemma/v1/agent_pb";
import { AuthService } from "@/gen/lemma/v1/auth_pb";
import { SessionService } from "@/gen/lemma/v1/session_pb";
import { ProviderService } from "@/gen/lemma/v1/provider_pb";
import { SystemService } from "@/gen/lemma/v1/system_pb";
import { transport } from "./transport";

export const agentClient = createClient(AgentService, transport);
export const authClient = createClient(AuthService, transport);
export const sessionClient = createClient(SessionService, transport);
export const providerClient = createClient(ProviderService, transport);
export const systemClient = createClient(SystemService, transport);
