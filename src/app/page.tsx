'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fetchAIContext } from './api';
import { GoogleGenerativeAI } from "@google/generative-ai";
import ReactMarkdown from 'react-markdown';

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY as string);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

interface Message {
  text: string;
  isUser: boolean;
}

const ChatApp = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;
    setIsLoading(true);
    setMessages(prev => [...prev, { text: input, isUser: true }]);
    setInput('');

    try {
      const contextData = await fetchAIContext(input);
      await streamGenAIResponse(contextData, input);
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, { text: 'Sorry, an error occurred.', isUser: false }]);
    } finally {
      setIsLoading(false);
    }
  };

  const streamGenAIResponse = async (context: string, question: string) => {
    const prompt = `The following is context intended to help you answer the user's question. Here is the context: <context>${context}</context>. The user's question is: <user_question>${question}</user_question>. Please answer the user's question using the context provided. Do NOT mention the context but rather answer the question naturally.`;
    const result = await model.generateContentStream(prompt);
    let accumulatedText = '';
    setMessages(prev => [...prev, { text: '', isUser: false }]);
    for await (const chunk of result.stream) {
      accumulatedText += chunk.text();
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = { text: accumulatedText, isUser: false };
        return newMessages;
      });
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto p-4">
      <Card className="flex-grow overflow-auto mb-4">
        <CardContent className="space-y-4">
          {messages.map((message) => (
            <div key={message.text} className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] p-2 rounded-lg ${message.isUser ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>
                {message.isUser ? (
                  message.text
                ) : (
                  <ReactMarkdown>{message.text}</ReactMarkdown>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </CardContent>
      </Card>
      <form onSubmit={handleSubmit} className="flex space-x-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          disabled={isLoading}
        />
        <Button type="submit" disabled={isLoading}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
};

export default ChatApp;
