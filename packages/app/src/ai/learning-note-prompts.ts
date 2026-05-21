export const LEARNING_NOTE_QUICK_ACTION_PROMPT =
  "请调用“生成学习笔记”技能，根据最近聊天记录和当前章节原文生成最多 3 条学习笔记并自动保存。必须先使用真实原文：如果最近消息含引用/选中文本，优先把引用作为原文候选；否则用 RAG 获取相关原文片段。每条笔记只绑定一个关键段落，匹配成功保存 sourceText；章首 fallback 需在反馈中标明。";
