'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, User, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { fetchAIContext } from './api';
import { GoogleGenerativeAI } from "@google/generative-ai";
import ReactMarkdown from 'react-markdown';

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY as string);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

interface Message {
  text: string;
  isUser: boolean;
  timestamp: Date;
}

const ChatApp = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  // Auto-resize textarea as content grows
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'inherit';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [input]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    setIsLoading(true);
    setMessages(prev => [...prev, { text: input, isUser: true, timestamp: new Date() }]);
    setInput('');
    
    if (textareaRef.current) {
      textareaRef.current.style.height = 'inherit';
    }

    try {
      const currentQuestion = input;
      const chatHistory = messages.map(message => message.text)
      const contextData = await fetchAIContext({ current_question: currentQuestion, chat_history: chatHistory});
      await streamGenAIResponse(contextData, input);
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, { 
        text: 'Sorry, an error occurred. Please try again later.',
        isUser: false,
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const streamGenAIResponse = async (context: string, question: string) => {
    const prompt = `The following is context intended to help you answer the user's question. Here is the context: <context>${context}</context>. The user's question is: <user_question>${question}</user_question>. Please answer the question using the context provided. Do NOT mention the context but rather answer the question naturally.`;
    
    const result = await model.generateContentStream(prompt);
    let accumulatedText = '';
    
    setMessages(prev => [...prev, { text: '', isUser: false, timestamp: new Date() }]);
    
    for await (const chunk of result.stream) {
      accumulatedText += chunk.text();
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = {
          text: accumulatedText,
          isUser: false,
          timestamp: new Date()
        };
        return newMessages;
      });
    }
  };

  const handleKeyDown = (e : React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim()) {
        handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
      }
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto py-4 px-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`py-8 first:pt-4 ${
                message.isUser ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900'
              }`}
            >
              <div className="max-w-3xl mx-auto flex gap-4 px-4">
                <div className="mt-1 w-8 h-8 rounded-full flex items-center justify-center shrink-0">
                  {message.isUser ? (
                    <div className="bg-gray-300 dark:bg-gray-600 rounded-full p-1.5">
                      <User className="w-5 h-5 text-gray-800 dark:text-gray-200" />
                    </div>
                  ) : (
                    <div className="bg-green-500 rounded-full p-1.5">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {message.isUser ? 'You' : 'Assistant'}
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    {message.isUser ? (
                      <p>{message.text}</p>
                    ) : (
                      <ReactMarkdown>{message.text}</ReactMarkdown>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800">
        <div className="max-w-3xl mx-auto p-4">
          <form onSubmit={handleSubmit} className="relative">
            <div className="relative flex items-center">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message..."
                rows={1}
                className="w-full resize-none rounded-2xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 pr-12 text-sm focus:border-gray-300 focus:outline-none focus:ring-0 dark:focus:border-gray-500 dark:text-gray-100"
                style={{
                  maxHeight: '200px',
                  minHeight: '44px'
                }}
              />
              <Button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="absolute right-2 rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-600"
                variant="ghost"
                size="icon"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
              Press Enter to send, Shift + Enter for new line
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatApp;