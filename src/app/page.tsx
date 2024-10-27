"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Loader2, User, Bot, Trash2, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GoogleGenerativeAI } from "@google/generative-ai";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import {
  fetchResults,
  fetchContentFromLink,
  getQueriesFromMessages,
  ModelResponse,
  LinkScrapeResponse,
} from "./api";

const genAI = new GoogleGenerativeAI("AIzaSyA5tfuXTZusFLpo-G5Xp1casq_aypzUdoY");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

function trimToTokenLimit(text: string, maxTokens = 10000) {
  // Approximate 4 characters per token; adjust if the model has a different average.
  const approxTokens = Math.floor(text.length / 4);

  if (approxTokens <= maxTokens) {
    return text; // Already within limit
  }

  // Trim the text by character count to approximate token count within limit
  const maxChars = maxTokens * 4;
  return text.slice(0, maxChars);
}

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

export default function ChatApp() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const handleScroll = () => {
      if (scrollAreaRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = scrollAreaRef.current;
        setShowScrollButton(scrollHeight - scrollTop - clientHeight > 100);
      }
    };

    scrollAreaRef.current?.addEventListener("scroll", handleScroll);
    return () =>
      scrollAreaRef.current?.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      scrollToBottom();
    }
  }, [messages, isLoading]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "inherit";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    setIsLoading(true);
    const newMessage: Message = {
      id: Date.now().toString(),
      text: input,
      isUser: true,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);
    setInput("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "inherit";
    }
    try {
      const messagesToWorkFrom = [...messages, newMessage];
      const userMessages = messagesToWorkFrom.filter(
        (message) => message.isUser,
      );
      const chatHistory = userMessages.map((message) => message.text);
      const query = await getQueriesFromMessages(chatHistory);
      if (!query) {
        return;
      }
      const responseAsJson = JSON.parse(query) as ModelResponse;
      const queries = responseAsJson.response.slice(0, 3);
      const linkResults = await Promise.allSettled(
        queries.slice(0, 2).map((query: string) => fetchResults(query)),
      );
      const fulfilledResults = linkResults.filter(
        (result) => result.status === "fulfilled",
      );
      const linksToSearch = fulfilledResults
        .map((result) => result.value.results.map((item) => item.url))
        .flat();
      const fillteredLinks = linksToSearch
        .filter((link) => {
          const formattedUrl = link.toLowerCase();
          return (
            !formattedUrl.includes("instagram") &&
            !formattedUrl.includes("twitter") &&
            !formattedUrl.includes("youtube") &&
            !formattedUrl.includes("letsrun")
          );
        })
        .map((item) => {
          return item;
        });
      const fetchWithTimeout = async (link: string, timeout = 750) => {
        return Promise.race([
          fetchContentFromLink(link),
          new Promise<LinkScrapeResponse>((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), timeout),
          ),
        ]);
      };

      const linkPromises = await Promise.all(
        fillteredLinks.map(async (link) => {
          try {
            return await fetchWithTimeout(link);
          } catch (error: unknown) {
            console.warn(
              `Skipped link due to timeout or error: ${link} due to ${error}`,
            );
            return null; // Skip this link
          }
        }),
      );
      // Filter out null values (the skipped links)
      const resolvedLinks = linkPromises.filter((link) => link !== null);
      const context = resolvedLinks
        .map((link) => trimToTokenLimit(link.content))
        .join("\n");
      console.log("CONTEXT", context);
      await streamGenAIResponse(context, input);
    } catch (error) {
      console.error("Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          text: "Sorry, an error occurred. Please try again later.",
          isUser: false,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const streamGenAIResponse = async (context: string, question: string) => {
    const prompt = `The following is context intended to help you answer the user's question. Here is the context: <context>${context}</context>. The user's question is: <user_question>${question}</user_question>. Please answer the question using the context provided. Do NOT mention the context but rather answer the question naturally.`;

    const result = await model.generateContentStream(prompt);
    let accumulatedText = "";

    const newMessage: Message = {
      id: Date.now().toString(),
      text: "",
      isUser: false,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);

    for await (const chunk of result.stream) {
      accumulatedText += chunk.text();
      setMessages((prev) => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage.id === newMessage.id) {
          lastMessage.text = accumulatedText;
        }
        return newMessages;
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim()) {
        handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
      }
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 py-4 px-4 sm:px-6 lg:px-8 shadow-sm">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            AI Chat Assistant
          </h1>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={clearChat}>
                  <Trash2 className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Clear chat</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </header>
      <ScrollArea className="flex-1 overflow-y-auto" ref={scrollAreaRef}>
        <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className={`py-6 ${
                  message.isUser
                    ? "bg-white dark:bg-gray-800"
                    : "bg-gray-50 dark:bg-gray-900"
                } rounded-lg shadow-sm mb-4`}
              >
                <div className="max-w-3xl mx-auto flex gap-4">
                  <div className="mt-1 w-10 h-10 rounded-full flex items-center justify-center shrink-0">
                    {message.isUser ? (
                      <div className="bg-blue-500 rounded-full p-2">
                        <User className="w-6 h-6 text-white" />
                      </div>
                    ) : (
                      <div className="bg-green-500 rounded-full p-2">
                        <Bot className="w-6 h-6 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 space-y-2 flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {message.isUser ? "You" : "Assistant"}
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
              </motion.div>
            ))}
          </AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="flex items-center justify-center py-4"
            >
              <div className="flex items-center space-x-2 bg-white dark:bg-gray-800 px-4 py-2 rounded-full shadow-sm">
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  AI is thinking...
                </span>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {showScrollButton && (
        <Button
          className="absolute bottom-24 right-4 rounded-full shadow-lg"
          size="icon"
          onClick={scrollToBottom}
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
      )}

      <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-md">
        <div className="max-w-4xl mx-auto p-4">
          <form onSubmit={handleSubmit} className="relative">
            <div className="relative flex items-center">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message here..."
                rows={1}
                className="w-full resize-none rounded-2xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 pr-12 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:border-blue-500 dark:text-gray-100 dark:focus:ring-blue-500 transition-shadow duration-200"
                style={{
                  maxHeight: "200px",
                  minHeight: "44px",
                }}
              />
              <Button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="absolute right-2 rounded-lg p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-gray-600 transition-colors duration-200"
                variant="ghost"
                size="icon"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
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
}
