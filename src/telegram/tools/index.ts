// Export all Telegram tool definitions.

import { getChatsToolDefinition } from './get-chats';
import { getMessagesToolDefinition } from './get-messages';
import { getContactsToolDefinition } from './get-contacts';
import { getChatStatsToolDefinition } from './get-chat-stats';



/**
 * Get all storage-related tool definitions.
 */
export const tools: ToolDefinition[] = [
  getChatsToolDefinition,
  getMessagesToolDefinition,
  getContactsToolDefinition,
  getChatStatsToolDefinition,
];

export default tools;
