/**
 * 发送消息工具集 —— 解析聊天框输入的指令
 */

/** 解析指令（取第一个空格分隔的 token） */
export function parseInstruction(message: string | null | undefined): string {
  if (!message || message.length === 0) return ''
  const strings = message.trim().split(/\s+/)
  return strings.length > 0 ? strings[0] : ''
}

/** 解析指令后的内容 */
export function parseContent(instruction: string, message: string | null | undefined): string {
  if (!message || message.length === 0) return ''
  const replaced = message.replace(instruction, '')
  return replaced.length > 0 ? replaced.replace(/^\s*/g, '') : ''
}
