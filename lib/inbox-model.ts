import type { Conversation } from "@/lib/types";

export type ConversationGroup = "buyers" | "sellers" | "partner";
/** Tabs describe the other participant, not a permanent role assigned to a user. */
export function conversationGroup(conversation: Conversation, userId: string): ConversationGroup {
  if (conversation.partnerId) return "partner";
  return conversation.sellerId === userId ? "buyers" : "sellers";
}
