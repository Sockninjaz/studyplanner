# Future Enhancements & Backlog

## AI Context & Hours Tuning
- Refine the AI's contextual awareness when generating study plans.
- Ensure that the generated topics and the estimated study hours are perfectly balanced and realistic based on the exam date and student profile.

## Smart Exam Regeneration
- Improve the exam rescheduling/regeneration logic.
- If a student is genuinely overwhelmed (e.g., falling behind on tasks), the system should dynamically and smartly reduce/condense the remaining sessions instead of just piling them up into an impossible task load.

## Inline Mini-Chat (Threaded Replies)
- Add threaded, collapsible mini-chats inside specific AI messages.
- Allows users to ask targeted follow-up questions without losing their place in the main chat.
- Requires adding `inlineChats` array to MongoDB `MessageSchema`, updating `/api/chat` to handle parent messages, and modifying the frontend `ChatMessage` UI to support nested inputs.
