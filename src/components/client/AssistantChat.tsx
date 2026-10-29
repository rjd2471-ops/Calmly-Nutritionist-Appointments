/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  X,
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Trash2,
  Calendar,
  Clock,
  Sparkles,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { AssistantProposal, SlotInfo } from '../../types.ts';
import {
  formatDateDisplay,
  formatTimeDisplay,
  generateSlotsForDay,
  getNowInIST,
  addDaysIST,
} from '../../lib/ist.ts';
import { normalizePhone } from '../../lib/normalize.ts';
import { getRepository } from '../../lib/repository/index.ts';
import { useToast } from '../common/Toast.tsx';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  proposal?: AssistantProposal;
  quickReplies?: string[];
}

export const AssistantChat: React.FC = () => {
  const { showToast } = useToast();
  const repo = getRepository();

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Hello! I am Calmly’s booking assistant. How may I help you today? You can ask me to find appointment slots, clarify clinic guidelines, or begin booking.',
      quickReplies: ['Book for tomorrow', 'What should I prepare?', 'How do I reschedule?', 'Consultation fees'],
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeakingEnabled, setIsSpeakingEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechLang, setSpeechLang] = useState<'en-IN' | 'hi-IN'>('en-IN');
  const [recognitionSupported, setRecognitionSupported] = useState(false);
  const [fallbackMode, setFallbackMode] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Check speech recognition support
  useEffect(() => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRec) {
      setRecognitionSupported(true);
      const rec = new SpeechRec();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = speechLang;

      rec.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript || '';
        if (transcript) {
          setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
        setIsListening(false);
      };

      rec.onerror = (e: any) => {
        console.warn('SpeechRecognition error:', e);
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }
  }, [speechLang]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const speakReply = (text: string) => {
    if (!isSpeakingEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*_#`]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = speechLang;
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  const handleToggleVoiceInput = () => {
    if (!recognitionSupported || !recognitionRef.current) {
      showToast({ type: 'info', message: 'Speech recognition is not supported in this browser.' });
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.lang = speechLang;
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.warn('Failed to start speech recognition:', err);
        setIsListening(false);
      }
    }
  };

  // Fallback guided conversation handler if server is unavailable
  const handleFallbackFlow = async (userText: string) => {
    const lower = userText.toLowerCase();
    const now = getNowInIST();

    if (lower.includes('book') || lower.includes('appointment') || lower.includes('tomorrow')) {
      const targetDate = lower.includes('tomorrow') ? addDaysIST(now.date, 1) : addDaysIST(now.date, 1);
      const appts = await repo.getAppointments();
      const slots = generateSlotsForDay(targetDate, appts).filter((s) => !s.isPast && !s.isTaken);

      const availableTimes = slots.slice(0, 3).map((s) => s.time);
      return {
        reply: `Here are available times for ${formatDateDisplay(targetDate)}: ${availableTimes.join(', ')}. Tap one or tell me your preferred slot. (Guided offline mode active)`,
        quickReplies: availableTimes.map((t) => `Book ${formatDateDisplay(targetDate)} at ${t}`),
      };
    }

    if (lower.includes('prepare') || lower.includes('bring')) {
      return {
        reply:
          'Please have your recent lab reports (blood panels from the past 6–12 months) and a brief log of your typical daily meals and supplements.',
        quickReplies: ['Book consultation', 'Cancel & Reschedule rules'],
      };
    }

    if (lower.includes('reschedule') || lower.includes('cancel')) {
      return {
        reply:
          'You can cancel or reschedule any appointment up to 2 hours before the start time directly from the "My Appointments" tab.',
        quickReplies: ['Book consultation', 'What should I prepare?'],
      };
    }

    return {
      reply:
        'I can assist you with booking or answering questions about consultations. What would you like help with? (The full assistant is available on the live site).',
      quickReplies: ['Book for tomorrow', 'What should I prepare?', 'How do I reschedule?'],
    };
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: query,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const clientPhone = localStorage.getItem('calmly_client_phone') || null;

      // Make request to /api/assistant
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          deviceContext: { phone: clientPhone },
        }),
      });

      if (!res.ok) {
        throw new Error(`API returned status ${res.status}`);
      }

      const data = await res.json();

      if (data.isFallbackRequired) {
        setFallbackMode(true);
        const fallbackRes = await handleFallbackFlow(query);
        const botMsg: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: fallbackRes.reply,
          quickReplies: fallbackRes.quickReplies,
        };
        setMessages((prev) => [...prev, botMsg]);
        speakReply(fallbackRes.reply);
        return;
      }

      const botMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.reply || 'Here is what I found.',
        proposal: data.proposedBooking || undefined,
      };

      setMessages((prev) => [...prev, botMsg]);
      speakReply(botMsg.content);
    } catch (err) {
      console.warn('Backend assistant request failed, switching to guided fallback:', err);
      setFallbackMode(true);
      const fallbackRes = await handleFallbackFlow(query);
      const botMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: fallbackRes.reply,
        quickReplies: fallbackRes.quickReplies,
      };
      setMessages((prev) => [...prev, botMsg]);
      speakReply(fallbackRes.reply);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmProposal = async (proposal: AssistantProposal, msgId: string) => {
    try {
      setIsLoading(true);
      const normPhone = normalizePhone(proposal.phone);

      const created = await repo.createAppointment({
        client_name: proposal.client_name,
        phone: normPhone,
        date: proposal.date,
        time: proposal.time,
        source: 'client',
        status: 'Booked',
        visit_type: proposal.visit_type,
        reason: proposal.goal || 'General wellness',
      });

      if (normPhone) {
        localStorage.setItem('calmly_client_phone', normPhone);
      }

      // Update message to reflect confirmed state
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, proposal: undefined } : m))
      );

      const successMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Your consultation is confirmed for ${formatDateDisplay(created.date)} at ${formatTimeDisplay(created.time)} IST (${created.visit_type}). A calendar invite has been prepared.`,
        quickReplies: ['What should I prepare?'],
      };
      setMessages((prev) => [...prev, successMsg]);

      showToast({
        type: 'success',
        message: 'Consultation successfully booked!',
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : (err as any)?.message || 'Failed to book slot.';
      const failMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Sorry, ${errorMsg} Would you like me to check other available slots?`,
        quickReplies: ['Check next available slots'],
      };
      setMessages((prev) => [...prev, failMsg]);
      showToast({ type: 'error', message: errorMsg });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: 'Conversation cleared. How can I help you schedule today?',
        quickReplies: ['Book for tomorrow', 'What should I prepare?', 'How do I reschedule?'],
      },
    ]);
  };

  return (
    <>
      {/* Floating Chat Trigger Button */}
      {!isOpen && (
        <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-40">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2 px-4 py-3 bg-emerald-800 text-white rounded-full shadow-lg hover:bg-emerald-900 transition-transform active:scale-95 cursor-pointer"
            aria-label="Open AI Assistant"
          >
            <Sparkles className="w-5 h-5 text-emerald-300" />
            <span className="text-xs font-semibold tracking-tight">Ask Calmly</span>
          </button>
        </div>
      )}

      {/* Assistant Modal / Drawer */}
      {isOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-full md:w-96 md:h-[620px] md:bottom-6 md:top-auto md:right-6 bg-white md:rounded-3xl shadow-2xl border border-stone-200/90 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-emerald-800 text-white p-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-700/80 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-emerald-200" />
              </div>
              <div>
                <h3 className="text-sm font-semibold leading-tight">Calmly Assistant</h3>
                <span className="text-[10px] text-emerald-200/90 block">
                  {fallbackMode ? 'Guided Offline Mode' : 'AI Clinic & Booking Guide'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsSpeakingEnabled(!isSpeakingEnabled)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isSpeakingEnabled ? 'bg-emerald-700 text-white' : 'text-emerald-300 hover:text-white'
                }`}
                title={isSpeakingEnabled ? 'Voice output on' : 'Voice output off'}
              >
                {isSpeakingEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={handleClearChat}
                className="p-1.5 text-emerald-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                title="Clear conversation"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-emerald-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                aria-label="Close assistant"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Medical Disclaimer Banner */}
          <div className="bg-stone-100 px-3.5 py-1.5 text-[10px] text-stone-600 border-b border-stone-200/80 text-center font-medium">
            General information only, not medical advice. Confirm on card to book.
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs bg-stone-50/50">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl p-3 leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-emerald-800 text-white rounded-tr-xs'
                      : 'bg-white text-stone-800 border border-stone-200/80 rounded-tl-xs shadow-xs'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>

                  {/* Booking Proposal Confirmation Card */}
                  {m.proposal && (
                    <div className="mt-3 p-3 bg-emerald-50/80 rounded-xl border border-emerald-200 text-stone-800 space-y-2">
                      <div className="flex items-center gap-1.5 text-emerald-900 font-semibold text-xs pb-1 border-b border-emerald-200/60">
                        <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Proposed Consultation</span>
                      </div>
                      <div className="text-[11px] space-y-1">
                        <div>
                          <strong>Client:</strong> {m.proposal.client_name}
                        </div>
                        <div>
                          <strong>Phone:</strong> {m.proposal.phone}
                        </div>
                        <div>
                          <strong>Date:</strong> {formatDateDisplay(m.proposal.date)}
                        </div>
                        <div>
                          <strong>Time:</strong> {formatTimeDisplay(m.proposal.time)} IST
                        </div>
                        <div>
                          <strong>Format:</strong> {m.proposal.visit_type}
                        </div>
                        {m.proposal.goal && (
                          <div>
                            <strong>Focus:</strong> {m.proposal.goal}
                          </div>
                        )}
                      </div>
                      <div className="pt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleConfirmProposal(m.proposal!, m.id)}
                          className="flex-1 py-1.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                        >
                          Confirm &amp; Book
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMessages((prev) =>
                              prev.map((item) =>
                                item.id === m.id ? { ...item, proposal: undefined } : item
                              )
                            );
                            handleSendMessage('I would like to change the slot or details.');
                          }}
                          className="py-1.5 px-3 bg-white hover:bg-stone-100 text-stone-700 border border-stone-300 rounded-lg text-xs cursor-pointer"
                        >
                          Change
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick Replies */}
                {m.quickReplies && m.quickReplies.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2 max-w-[90%]">
                    {m.quickReplies.map((qr, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSendMessage(qr)}
                        className="text-[11px] font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-full transition-colors cursor-pointer"
                      >
                        {qr}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-1.5 text-stone-400 text-xs py-2">
                <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce [animation-delay:0.4s]" />
                <span className="text-[11px] text-stone-500 ml-1">Calmly is checking...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Voice Language Toggle (if speech supported) */}
          {recognitionSupported && (
            <div className="px-4 py-1.5 bg-stone-50 border-t border-stone-200/80 flex items-center justify-between text-[11px] text-stone-500">
              <span className="flex items-center gap-1">
                <Mic className="w-3 h-3 text-emerald-700" />
                Voice Language:
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSpeechLang('en-IN')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${
                    speechLang === 'en-IN' ? 'bg-emerald-800 text-white font-semibold' : 'text-stone-600'
                  }`}
                >
                  English (India)
                </button>
                <button
                  type="button"
                  onClick={() => setSpeechLang('hi-IN')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${
                    speechLang === 'hi-IN' ? 'bg-emerald-800 text-white font-semibold' : 'text-stone-600'
                  }`}
                >
                  हिंदी (Hindi)
                </button>
              </div>
            </div>
          )}

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-white border-t border-stone-200/80 flex items-center gap-2"
          >
            {recognitionSupported && (
              <button
                type="button"
                onClick={handleToggleVoiceInput}
                className={`p-2.5 rounded-xl transition-colors cursor-pointer shrink-0 ${
                  isListening
                    ? 'bg-rose-100 text-rose-700 animate-pulse'
                    : 'text-stone-500 hover:text-stone-800 bg-stone-100 hover:bg-stone-200'
                }`}
                title={isListening ? 'Stop listening' : 'Speak message'}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}

            <input
              type="text"
              placeholder={isListening ? 'Listening... speak now' : 'Ask anything or book a slot...'}
              value={input}
              maxLength={500}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 px-3.5 py-2 text-base sm:text-xs bg-stone-50 border border-stone-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-700"
            />

            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="p-2.5 text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 rounded-xl transition-colors cursor-pointer shrink-0"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
