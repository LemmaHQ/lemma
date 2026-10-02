import { createClient } from "@connectrpc/connect";

import { AgentService } from "@/gen/lemma/v1/agent_pb";
import { AuthService } from "@/gen/lemma/v1/auth_pb";
import { ConversationService } from "@/gen/lemma/v1/conversation_pb";
import { ProviderService } from "@/gen/lemma/v1/provider_pb";
import { transport } from "./transport";

export const agentClient = createClient(AgentService, transport);
export const authClient = createClient(AuthService, transport);
export const conversationClient = createClient(ConversationService, transport);
export const providerClient = createClient(ProviderService, transport);
