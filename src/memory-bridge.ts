// ==================== 记忆系统对接 ====================
// 全部改动留在 p-shop：直接操作 satori-ai 的分层记忆表（sat_*），
// 不要求 satori-ai 暴露新方法，也不修改它的源码。
//
// 作用域规则与 satori-ai 一致：personal_memory 时为 userId，否则为 channelId。
// 该配置从 sat 服务的公开 config 读取；sat 不存在说明 satori-ai 未启用。
import { Context, Session } from 'koishi'
import { promises as fs } from 'fs'
import * as path from 'path'

export interface EraseResult {
  /** sat_dialogue 原始对话 */
  dialogues: number
  /** 整条删除的分层记忆（topic 命中，或高层删句后已为空） */
  memories: number
  /** 高层记忆（day 及以上）只删掉命中句子的条数 */
  redacted: number
  /** sat_profile 画像条目 */
  profile: number
  /** 内存里的短期记忆条目 */
  shortTerm: number
}

const TOPIC_GRANULARITY = 'topic'
const HIGHER_GRANULARITIES = ['day', 'week', 'month', 'season', 'year']

/**
 * 去掉 text 里包含 word 的句子，按换行分别处理并保留剩余内容。
 * 句末标点跟随句子一起删除；没有句末标点的整行视为一句。
 */
function removeKeywordSentences(text: string, word: string): { text: string; removed: number } {
  let removed = 0
  const lines = text.split('\n').map((line) => {
    const sentences = line.match(/[^。！？；!?;…]+(?:[。！？；!?;…]+|$)/g) || [line]
    const kept = sentences.filter(sentence => !sentence.includes(word))
    removed += sentences.length - kept.length
    return kept.join('').trim()
  }).filter(line => line.length > 0)
  return { text: lines.join('\n'), removed }
}

interface SatLike {
  config?: {
    personal_memory?: boolean
    dataDir?: string
  }
  memoryService?: {
    clearChannelMemory?: (scopeId: string) => void
    shortTerm?: {
      channelMemories?: Map<string, { dialogues: { role: string; content: string }[] }>
      clearChannelMemory?: (scopeId: string) => void
    }
  }
}

export const FORGOTTEN_HINT = '你似乎曾经和他很熟悉，但是你已经忘记了'

/** 取 satori-ai 注册的 sat 服务；它存在即说明 sat_* 表已由 satori-ai 扩展 */
function getSat(ctx: Context): SatLike | null {
  try {
    return (ctx as any).get?.('sat') || null
  } catch {
    return null
  }
}

export function isMemoryReady(ctx: Context): boolean {
  return !!getSat(ctx)
}

function isPersonalMemory(ctx: Context): boolean {
  // 配置缺省时与 satori-ai 的 schema 默认值一致：按人记忆
  return getSat(ctx)?.config?.personal_memory !== false
}

function getMemoryDataDir(ctx: Context): string {
  return getSat(ctx)?.config?.dataDir || './data/satori_ai'
}

/** 有 session 时按 satori-ai 的作用域规则解析；没有就退回按 userId */
export function getMemoryScopeId(ctx: Context, session: Session | undefined, userId: string): string {
  if (isPersonalMemory(ctx)) return (session?.userId || userId) as string
  return (session?.channelId || userId) as string
}

/**
 * 按关键词遗忘：原始对话、分层记忆、画像条目、短期记忆一起删。
 * 分层记忆是模型写出的摘要，命中与否取决于摘要用词；要「全部忘掉」用 forgetAllMemories。
 */
export async function eraseMemoriesByKeyword(
  ctx: Context,
  scopeId: string,
  keyword: string,
): Promise<EraseResult> {
  const db = (ctx as any).database
  const word = keyword.trim()
  const result: EraseResult = { dialogues: 0, memories: 0, redacted: 0, profile: 0, shortTerm: 0 }
  if (!word) return result

  // 关键词按字面匹配，避免 .* 之类的输入把整个库删光
  const pattern = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  const dialogues = await db.get('sat_dialogue', {
    scopeId,
    $or: [
      { userContent: { $regex: pattern } },
      { aiContent: { $regex: pattern } },
    ],
  }, { fields: ['id'] })
  if (dialogues.length) {
    await db.remove('sat_dialogue', { id: { $in: dialogues.map((row: any) => row.id) } })
    result.dialogues = dialogues.length
  }

  // topic 是单轮/单话题的原始摘要，命中就整条删；
  // day 及更高层是模型压缩过的总结，只摘掉命中关键词的句子，保留同一节点里的其他内容。
  const topicMemories = await db.get('sat_memory', {
    scopeId,
    granularity: TOPIC_GRANULARITY,
    $or: [
      { topic: { $regex: pattern } },
      { content: { $regex: pattern } },
      { userState: { $regex: pattern } },
    ],
  }, { fields: ['id'] })

  const higherMemories = await db.get('sat_memory', {
    scopeId,
    granularity: { $in: HIGHER_GRANULARITIES },
    $or: [
      { content: { $regex: pattern } },
      { userState: { $regex: pattern } },
    ],
  }, { fields: ['id', 'content', 'userState'] })

  const removeIds: any[] = topicMemories.map((row: any) => row.id)

  for (const row of higherMemories) {
    let content = String(row.content || '')
    let userState = String(row.userState || '')
    let edited = false

    if (content.includes(word)) {
      const next = removeKeywordSentences(content, word)
      if (next.removed) {
        content = next.text
        edited = true
      }
    }
    if (userState.includes(word)) {
      const next = removeKeywordSentences(userState, word)
      if (next.removed) {
        userState = next.text
        edited = true
      }
    }
    if (!edited) continue

    if (!content.trim()) {
      // 整条内容都被摘空，节点没有保留价值，直接删掉
      removeIds.push(row.id)
    } else {
      await db.set('sat_memory', { id: row.id }, { content, userState })
      result.redacted++
    }
  }

  if (removeIds.length) {
    await db.remove('sat_memory', { id: { $in: removeIds } })
    result.memories = removeIds.length
  }

  const [profile] = await db.get('sat_profile', { scopeId }, { limit: 1 })
  const entries: any[] = profile?.data?.entries || []
  const kept = entries.filter(entry => !String(entry?.content || '').includes(word))
  if (kept.length !== entries.length) {
    result.profile = entries.length - kept.length
    await db.set('sat_profile', { scopeId }, {
      data: { ...profile.data, entries: kept },
      updatedAt: new Date(),
    })
  }

  result.shortTerm = eraseShortTerm(ctx, scopeId, word)

  // 新系统不再读旧文件，但 `sat.memory.migrate -f` 会重新导入；
  // 同步写回，避免强制迁移把删掉的内容复活。
  if (isPersonalMemory(ctx)) {
    await eraseLegacyDialogues(getMemoryDataDir(ctx), scopeId, word)
  }

  return result
}

/** 败者食尘：清空该 scope 的全部对话、分层记忆和画像，只留下一条提示。 */
export async function forgetAllMemories(
  ctx: Context,
  scopeId: string,
  hint = FORGOTTEN_HINT,
): Promise<void> {
  const db = (ctx as any).database
  const at = new Date()

  await db.transact(async (tx: any) => {
    await tx.remove('sat_dialogue', { scopeId })
    await tx.remove('sat_memory', { scopeId })
    await tx.remove('sat_profile', { scopeId })
  })

  // 保留 meta 行、把归档游标推到当前时刻；不复位 lastActiveAt，
  // 避免一次清空让休眠 scope 白占心跳活跃窗口。
  const [meta] = await db.get('sat_meta', { scopeId }, { limit: 1 })
  if (!meta) {
    try {
      await db.create('sat_meta', {
        scopeId,
        topicStart: at,
        lastActiveAt: at,
        migratedAt: new Date(0),
      })
    } catch {
      // 并发创建触发唯一约束时忽略
    }
  } else {
    await db.set('sat_meta', { scopeId }, { topicStart: at })
  }

  await db.create('sat_profile', {
    scopeId,
    data: {
      entries: [{
        key: 'forgotten',
        category: 'fact',
        content: hint,
        importance: 100,
        updatedAt: at.toISOString(),
      }],
    },
    updatedAt: at,
  })

  clearShortTerm(ctx, scopeId)

  if (isPersonalMemory(ctx)) {
    await clearLegacyDialogues(getMemoryDataDir(ctx), scopeId)
  }
}

// ---------- 短期记忆（尽力而为） ----------
// 短期记忆是 satori-ai 进程内的 ring，没有公开的删除接口。
// 字段名在打包产物里不会被压缩，这里直接改 ring；失败也不影响持久记忆已删除。

function eraseShortTerm(ctx: Context, scopeId: string, word: string): number {
  try {
    const memory = getSat(ctx)?.memoryService?.shortTerm?.channelMemories?.get(scopeId)
    if (!memory?.dialogues) return 0
    const before = memory.dialogues.length
    memory.dialogues = memory.dialogues.filter(entry => !String(entry?.content || '').includes(word))
    return before - memory.dialogues.length
  } catch {
    return 0
  }
}

function clearShortTerm(ctx: Context, scopeId: string): void {
  try {
    const service = getSat(ctx)?.memoryService
    if (typeof service?.clearChannelMemory === 'function') {
      service.clearChannelMemory(scopeId)
    } else {
      service?.shortTerm?.clearChannelMemory?.(scopeId)
    }
  } catch {
    // 短期记忆清理失败不影响持久记忆
  }
}

// ---------- 旧文件 ----------
// 迁移后新系统不再读取 dialogues/*.txt，但 `migrate -f` 会重跑。

function legacyDialogueFile(dataDir: string, scopeId: string): string {
  // scopeId 来自 session，理论上只有数字；仍然避免路径穿越
  const safe = scopeId.replace(/[\\/:*?"<>|]/g, '_')
  return path.join(dataDir, 'dialogues', `${safe}.txt`)
}

async function eraseLegacyDialogues(dataDir: string, scopeId: string, word: string): Promise<void> {
  const file = legacyDialogueFile(dataDir, scopeId)
  try {
    const entries = JSON.parse(await fs.readFile(file, 'utf-8'))
    if (!Array.isArray(entries)) return
    const kept = entries.filter((entry: any) => !String(entry?.content || '').includes(word))
    if (kept.length !== entries.length) {
      await fs.writeFile(file, JSON.stringify(kept, null, 2), 'utf-8')
    }
  } catch {
    // 文件不存在或不是旧格式
  }
}

async function clearLegacyDialogues(dataDir: string, scopeId: string): Promise<void> {
  const file = legacyDialogueFile(dataDir, scopeId)
  try {
    await fs.access(file)
  } catch {
    return
  }
  await fs.writeFile(file, '[]', 'utf-8')
}
