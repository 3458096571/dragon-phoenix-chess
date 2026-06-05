import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Copy, Check, RotateCcw, Bot, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
  time: string;
  id: string;
}

interface AIChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  loading: boolean;
  onClear?: () => void;
}

// 打字机效果 hook
function useTypewriter(text: string, speed: number = 30) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  const indexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    indexRef.current = 0;
    setDisplayed('');
    setDone(false);

    const typeNext = () => {
      if (indexRef.current < text.length) {
        const next = text.slice(0, indexRef.current + 1);
        setDisplayed(next);
        indexRef.current++;
        timerRef.current = setTimeout(typeNext, speed);
      } else {
        setDone(true);
      }
    };

    timerRef.current = setTimeout(typeNext, speed);
    return () => clearTimeout(timerRef.current);
  }, [text, speed]);

  return { displayed, done };
}

// AI 消息气泡组件 - 带打字机效果
function AIMessageBubble({ message, isLatest }: { message: ChatMessage; isLatest: boolean }) {
  const { displayed, done } = useTypewriter(isLatest ? message.text : message.text, isLatest ? 25 : 0);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(message.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [message.text]);

  const textToShow = isLatest && !done ? displayed : message.text;

  return (
    <div className="flex gap-2.5 animate-in slide-in-from-bottom-2 duration-300">
      {/* AI 头像 */}
      <div className="shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-[#c084fc] to-[#7c3aed] flex items-center justify-center shadow-lg shadow-purple-500/20">
        <Bot className="w-3.5 h-3.5 text-white" />
      </div>

      <div className="flex-1 min-w-0">
        {/* 消息内容 */}
        <div className="bg-[#1a1a2e]/80 border border-[#c084fc]/20 rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm text-white/90 leading-relaxed">
          {textToShow}
          {isLatest && !done && (
            <span className="inline-block w-1.5 h-4 ml-0.5 bg-[#c084fc] animate-pulse align-middle" />
          )}
        </div>

        {/* 操作栏 */}
        <div className="flex items-center gap-2 mt-1 ml-1">
          <span className="text-[10px] text-white/25">{message.time}</span>
          {done && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-0.5 text-[10px] text-white/30 hover:text-[#c084fc] transition-colors"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? '已复制' : '复制'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// 用户消息气泡
function UserMessageBubble({ message }: { message: ChatMessage }) {
  return (
    <div className="flex gap-2.5 justify-end animate-in slide-in-from-bottom-2 duration-300">
      <div className="flex-1 min-w-0 flex flex-col items-end">
        <div className="bg-gradient-to-r from-[#d4a853] to-[#f0d78c] text-black rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-sm font-medium leading-relaxed max-w-[85%]">
          {message.text}
        </div>
        <span className="text-[10px] text-white/25 mt-1 mr-1">{message.time}</span>
      </div>
    </div>
  );
}

export function AIChatPanel({ messages, onSend, loading, onClear }: AIChatPanelProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  const handleSend = useCallback(() => {
    if (!input.trim() || loading) return;
    onSend(input.trim());
    setInput('');
    inputRef.current?.focus();
  }, [input, loading, onSend]);

  const latestAiIndex = messages.length - 1;

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2.5 border-b border-[#d4a853]/10">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#c084fc]" />
          <span className="text-sm font-medium text-[#d4a853]">AI 棋友</span>
          <span className="text-[10px] text-white/30 px-1.5 py-0.5 bg-white/5 rounded-full">Kimi-k2.6</span>
        </div>
        {messages.length > 0 && onClear && (
          <button
            onClick={onClear}
            className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/60 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            清空
          </button>
        )}
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="w-12 h-12 rounded-full bg-[#c084fc]/10 flex items-center justify-center mb-3">
              <Bot className="w-6 h-6 text-[#c084fc]/50" />
            </div>
            <p className="text-xs text-white/30 mb-1">和 AI 棋友聊聊天吧</p>
            <p className="text-[10px] text-white/20">可以问棋局策略、规则问题，或者闲聊~</p>
          </div>
        )}

        {messages.map((msg, i) =>
          msg.role === 'user' ? (
            <UserMessageBubble key={msg.id} message={msg} />
          ) : (
            <AIMessageBubble
              key={msg.id}
              message={msg}
              isLatest={i === latestAiIndex}
            />
          )
        )}

        {/* AI 正在输入 */}
        {loading && (
          <div className="flex gap-2.5">
            <div className="shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-[#c084fc] to-[#7c3aed] flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="bg-[#1a1a2e]/80 border border-[#c084fc]/20 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-white/50">思考中</span>
                <span className="flex gap-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#c084fc] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#c084fc] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#c084fc] animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* 输入框 */}
      <div className="shrink-0 p-2 border-t border-[#d4a853]/10">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="输入消息..."
            disabled={loading}
            className="flex-1 h-9 bg-[#0f0f1a] border-[#d4a853]/15 text-white text-sm placeholder:text-white/25 focus-visible:ring-[#c084fc]/30"
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="h-9 px-3 bg-gradient-to-r from-[#c084fc]/20 to-[#7c3aed]/20 hover:from-[#c084fc]/30 hover:to-[#7c3aed]/30 border border-[#c084fc]/30 disabled:opacity-30"
          >
            <Send className="w-4 h-4 text-[#c084fc]" />
          </Button>
        </div>
      </div>
    </div>
  );
}
