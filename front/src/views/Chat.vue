<template>
  <div class="chat-page">
    <!-- 左侧会话列表 -->
    <aside class="session-panel">
      <el-button type="primary" class="new-chat-btn" @click="onNewChat">
        <el-icon style="margin-right: 6px"><Plus /></el-icon>
        新建对话
      </el-button>

      <div class="session-list">
        <div
          v-for="s in chatStore.sessions"
          :key="s.id"
          class="session-item"
          :class="{ active: s.id === chatStore.currentSessionId }"
          @click="openSession(s.id)"
        >
          <el-icon :size="14"><ChatLineRound /></el-icon>
          <span class="session-title">{{ s.title }}</span>
          <el-icon class="session-del" :size="14" @click.stop="onDeleteSession(s.id)"><Delete /></el-icon>
        </div>

        <div v-if="!chatStore.sessions.length" class="session-empty">
          {{ chatStore.dbReady ? '暂无历史会话' : '历史会话需要数据库支持' }}
        </div>
      </div>

      <div class="session-count" v-if="chatStore.sessions.length">
        共 {{ chatStore.sessions.length }} 个历史会话
      </div>
    </aside>

    <!-- 右侧对话区 -->
    <div class="chat-main">
      <div ref="msgListRef" class="message-area">
        <!-- 空状态：快捷提问 -->
        <div v-if="!chatStore.messages.length" class="chat-empty">
          <div class="chat-empty-icon">
            <el-icon :size="48" color="#fff"><ChatDotRound /></el-icon>
          </div>
          <h3>AI 对话</h3>
          <p class="empty-desc">可以问我景点推荐、美食攻略，也可以直接说<br />「帮我规划北京 3 日游，预算 5000」试试</p>
          <div class="quick-list">
            <el-tag
              v-for="(q, i) in quickQuestions"
              :key="i"
              class="quick-tag"
              size="large"
              @click="send(q)"
            >
              {{ q }}
            </el-tag>
          </div>
        </div>

        <!-- 消息列表 -->
        <ChatBubble v-for="(m, i) in chatStore.messages" :key="i" :message="m" />
      </div>

      <!-- 输入区 -->
      <div class="input-area">
        <el-input
          v-model="input"
          type="textarea"
          :rows="2"
          resize="none"
          placeholder="输入你的问题，Enter 发送，Shift+Enter 换行"
          :disabled="chatStore.streaming"
          @keydown.enter.exact.prevent="send(input)"
        />
        <el-button
          v-if="!chatStore.streaming"
          type="primary"
          class="send-btn"
          :disabled="!input.trim()"
          @click="send(input)"
        >
          发送
          <el-icon style="margin-left: 4px"><Promotion /></el-icon>
        </el-button>
        <el-button v-else type="danger" plain class="send-btn" @click="stop">
          停止
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import ChatBubble from '@/components/ChatBubble.vue'
import { readSSE, createAborter } from '@/utils/sse'
import { getQuickQuestions } from '@/api/chat'
import { useChatStore } from '@/stores/chat'
import { useUserStore } from '@/stores/user'

const chatStore = useChatStore()
const userStore = useUserStore()

const input = ref('')
const msgListRef = ref(null)
const quickQuestions = ref([
  '北京有哪些必去的景点？',
  '帮我规划北京 3 日游，预算 5000',
  '成都的特色美食推荐',
  '出门旅行如何买保险？'
])

let aborter = null

async function scrollBottom() {
  await nextTick()
  const el = msgListRef.value
  if (el) el.scrollTop = el.scrollHeight
}

async function openSession(id) {
  if (chatStore.streaming) return
  await chatStore.openSession(id)
  scrollBottom()
}

function onNewChat() {
  if (chatStore.streaming) return
  chatStore.newSession()
}

async function onDeleteSession(id) {
  try {
    await ElMessageBox.confirm('删除后该会话的所有消息都会被清除，确定删除吗？', '删除会话', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
    await chatStore.deleteSession(id)
    ElMessage.success('会话已删除')
  } catch {
    // 用户取消
  }
}

async function send(text) {
  const content = (text || '').trim()
  if (!content || chatStore.streaming) return

  input.value = ''
  chatStore.setStreaming(true)

  const sessionId = await chatStore.ensureSession()
  chatStore.appendMessage({ role: 'user', type: 'text', content, timestamp: Date.now() })
  chatStore.appendMessage({ role: 'assistant', type: 'text', content: '', timestamp: Date.now(), streaming: true })
  const aiMessage = chatStore.messages[chatStore.messages.length - 1]
  scrollBottom()

  aborter = createAborter()

  try {
    const final = await readSSE({
      url: '/api/chat/completions',
      body: { message: content, sessionId },
      token: userStore.token,
      signal: aborter.signal,
      onEvent: (event, data) => {
        if (event === 'chunk') {
          aiMessage.content += data.content
          scrollBottom()
        }
      }
    })

    aiMessage.streaming = false

    if (final?.event === 'done') {
      if (final.data?.itinerary) {
        aiMessage.type = 'itinerary'
        aiMessage.itinerary = final.data.itinerary
        aiMessage.content = final.data.reply || aiMessage.content
      }
      chatStore.loadSessions()
    } else if (final?.event === 'error') {
      aiMessage.content = aiMessage.content || final.data?.message || '对话失败，请稍后重试'
      if (final.data?.message) ElMessage.error(final.data.message)
    }
  } catch (err) {
    aiMessage.streaming = false
    if (err.name !== 'AbortError') {
      aiMessage.content = aiMessage.content || '连接异常，请稍后重试'
      ElMessage.error(err.message || '对话失败')
    }
  } finally {
    chatStore.setStreaming(false)
    scrollBottom()
  }
}

function stop() {
  aborter?.abort()
}

onMounted(async () => {
  chatStore.loadSessions()
  try {
    const res = await getQuickQuestions()
    if (res.data?.length) {
      quickQuestions.value = [...res.data.slice(0, 3), '帮我规划北京 3 日游，预算 5000']
    }
  } catch {
    // 使用默认快捷问题
  }
})

onUnmounted(() => {
  aborter?.abort()
})
</script>

<style scoped>
.chat-page {
  display: flex;
  height: calc(100vh - var(--header-height) - 48px);
  gap: 20px;
}

/* 左侧会话面板 */
.session-panel {
  width: 260px;
  flex-shrink: 0;
  background: var(--color-card);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  padding: 16px;
  display: flex;
  flex-direction: column;
}

.new-chat-btn {
  width: 100%;
  margin-bottom: 14px;
  height: 44px;
  border-radius: 12px;
  font-size: 14px;
  letter-spacing: 1px;
}

.session-list {
  flex: 1;
  overflow-y: auto;
}

.session-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  color: var(--color-text-secondary);
  font-size: 13px;
  transition: all 0.15s;
  margin-bottom: 4px;
}

.session-item:hover {
  background: var(--color-hover);
}

.session-item.active {
  background: var(--color-primary-light);
  color: var(--color-primary);
  font-weight: 600;
}

.session-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-del {
  opacity: 0;
  transition: opacity 0.15s;
  color: var(--color-text-placeholder);
}

.session-item:hover .session-del {
  opacity: 1;
}

.session-del:hover {
  color: var(--color-danger);
}

.session-empty {
  text-align: center;
  color: var(--color-text-placeholder);
  font-size: 12px;
  padding: 24px 0;
}

.session-count {
  text-align: center;
  font-size: 11px;
  color: var(--color-text-placeholder);
  padding-top: 10px;
}

/* 右侧对话区 */
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--color-card);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
}

.message-area {
  flex: 1;
  overflow-y: auto;
  padding: 24px 28px;
}

.chat-empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.chat-empty-icon {
  width: 90px;
  height: 90px;
  border-radius: 50%;
  background: linear-gradient(135deg, #f56c0a, #f59e0b);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 18px;
  box-shadow: 0 12px 32px rgba(245, 108, 10, 0.22);
}

.chat-empty h3 {
  margin: 0 0 8px;
  font-size: 20px;
}

.empty-desc {
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.8;
}

.quick-list {
  margin-top: 24px;
  max-width: 520px;
}

.quick-tag {
  margin: 6px;
  cursor: pointer;
  border-radius: 999px;
  padding: 8px 14px;
  border: 1px solid var(--color-border);
  background: #fff;
  color: var(--color-text-secondary);
}

.quick-tag:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.input-area {
  display: flex;
  gap: 12px;
  padding: 14px 18px;
  border-top: 1px solid var(--color-border-light);
  align-items: flex-end;
}

.input-area :deep(.el-textarea__inner) {
  border-radius: 14px;
  padding: 12px 16px;
}

.send-btn {
  height: 52px;
  border-radius: 12px;
  padding: 0 22px;
}
</style>
