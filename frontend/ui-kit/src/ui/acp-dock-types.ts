export type AcpDockTask = {
  acp_conversation_id: string;
  task_id: string;
  agent_name: string;
  status: string;
  progress_message_id?: string;
};

export type ConversationAcpDockSnapshot = {
  conversation_id: string;
  tasks: AcpDockTask[];
  progress_text: string;
  task_progress: Record<string, string>;
  highlight_decision: boolean;
};
