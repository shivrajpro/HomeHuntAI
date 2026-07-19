import { AnimatePresence, motion } from 'framer-motion'

import { AssistantMessage } from '@/features/nestor/components/assistant-message'
import { NestorComposer } from '@/features/nestor/components/composer'
import { EmptyState } from '@/features/nestor/components/empty-states'
import {
  NestorAvatar,
  ThinkingIndicator,
  UserMessage,
} from '@/features/nestor/components/message-primitives'
import { NestorThinking } from '@/features/nestor/components/nestor-thinking'
import { useNestorChat } from '@/features/nestor/use-nestor-chat'
import { useDocumentTitle } from '@/lib/use-document-title'

/**
 * Nestor — a chat-style front end over the `reasoning` engine. The user
 * describes what they want in plain language; Gemini (via Supabase Edge
 * Functions) parses the brief into a structured intent, then reasons over a
 * deterministically shortlisted set of real candidate listings to pick, rank
 * and explain the recommendations — falling back to the local parser and
 * deterministic ranking independently if either call is unavailable. Picks
 * deep-link into the property detail pages. All conversation state lives in
 * `useNestorChat`; this page just lays out the turns and the composer.
 */
export function NestorPage() {
  useDocumentTitle('Ask Nestor · HomeHunt AI')
  const chat = useNestorChat()

  const isEmpty = chat.messages.length === 0

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] max-w-3xl flex-col">
      <div className="flex-1">
        {isEmpty ? (
          <EmptyState onPick={chat.submit} />
        ) : (
          <div className="space-y-6 py-2">
            <AnimatePresence initial={false}>
              {chat.messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                >
                  {m.role === 'user' ? (
                    <UserMessage text={m.text} />
                  ) : (
                    <AssistantMessage
                      message={m}
                      reranking={chat.rerankingId === m.id}
                      onEditPriorities={(priorities) =>
                        chat.editPriorities(m.id, priorities)
                      }
                      onPickExample={chat.submit}
                      onToggleSpeak={() =>
                        m.answer && chat.toggleSpeak(m.id, m.answer)
                      }
                      isSpeaking={chat.speakingId === m.id && chat.voice.speaking}
                      voiceSupported={chat.voice.supported}
                    />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            {chat.thinking &&
              (chat.liveTrace.length > 0 ? (
                <div className="flex gap-3">
                  <NestorAvatar />
                  <div className="min-w-0 flex-1">
                    <NestorThinking steps={chat.liveTrace} live />
                  </div>
                </div>
              ) : (
                <ThinkingIndicator />
              ))}
            <div ref={chat.scrollRef} />
          </div>
        )}
      </div>

      <NestorComposer
        input={chat.input}
        onInputChange={chat.setInput}
        onSend={chat.submit}
        thinking={chat.thinking}
        voice={chat.voice}
        dictation={chat.dictation}
        onToggleDictation={chat.toggleDictation}
      />
    </div>
  )
}
