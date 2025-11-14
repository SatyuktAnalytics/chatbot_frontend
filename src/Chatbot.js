import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  MessageCircle,
  ArrowLeft,
  ArrowRight,
  Globe,
} from "lucide-react";

//development server
// const API_BASE_URL = "http://127.0.0.1:8000";

//json based rag
// const API_BASE_URL = "https://satyuktanalytics-json-based-backend.hf.space";

//document based rag with generator model
const API_BASE_URL = "https://satyuktanalytics-generator-based-backend.hf.space";

const ChatBot = () => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [translatedRecommendations, setTranslatedRecommendations] = useState(
    []
  );
  const [languages, setLanguages] = useState({ English: "en" });
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [selectedLanguageName, setSelectedLanguageName] = useState("English");
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [hasRecommenderHistory, setHasRecommenderHistory] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [translatingIndex, setTranslatingIndex] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Initialize languages and recommendations
  useEffect(() => {
    const initializeApp = async () => {
      try {
        const langResponse = await fetch(`${API_BASE_URL}/languages`);
        if (langResponse.ok) {
          const langData = await langResponse.json();
          if (
            langData.languages &&
            Object.keys(langData.languages).length > 0
          ) {
            setLanguages(langData.languages);
          }
        }

        const recResponse = await fetch(
          `${API_BASE_URL}/recommendations/initial`
        );
        if (recResponse.ok) {
          const recData = await recResponse.json();
          if (
            recData.recommendations &&
            Array.isArray(recData.recommendations)
          ) {
            setRecommendations(recData.recommendations);
          }
        }
      } catch (error) {
        console.error("Error initializing app:", error);
      } finally {
        setIsInitialized(true);
      }
    };
    initializeApp();
  }, []);

  // Translate recommendations sequentially (one by one)
  useEffect(() => {
    const translateSequentially = async () => {
      if (!recommendations.length) {
        setTranslatedRecommendations([]);
        return;
      }

      if (selectedLanguage === "en") {
        setTranslatedRecommendations(recommendations);
        return;
      }

      setIsTranslating(true);
      setTranslatedRecommendations([]);

      for (let i = 0; i < recommendations.length; i++) {
        const rec = recommendations[i];
        setTranslatedRecommendations((prev) => [...prev, ""]);
        setTranslatingIndex(i);

        let translated = rec;
        try {
          const response = await fetch(`${API_BASE_URL}/translate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: rec,
              target_lang: selectedLanguage,
              source_lang: "en",
            }),
          });

          if (response.ok) {
            const data = await response.json();
            translated = data.translated_text || rec;
          }
        } catch (err) {
          console.error("Translation error:", err);
        }

        // replace the placeholder with actual translation
        setTranslatedRecommendations((prev) => {
          const copy = [...prev];
          copy[i] = translated;
          return copy;
        });

        setTranslatingIndex(null); // done translating this one
        await new Promise((resolve) => setTimeout(resolve, 50)); // allow render
      }

      setIsTranslating(false);
    };

    translateSequentially();
  }, [recommendations, selectedLanguage]);

  // Keyboard shortcut to open sidebar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === "l") {
        e.preventDefault();
        setIsSidebarOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const sendMessage = async (messageText = null) => {
    const textToSend = messageText || inputValue.trim();
    if (!textToSend) return;

    setIsLoading(true);
    const userMessage = { role: "user", content: textToSend };
    setMessages((prev) => [...prev, userMessage]);
    if (!messageText) setInputValue("");

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          user_language: selectedLanguage,
          chat_history: messages,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        const botMessage = { role: "assistant", content: data.answer };
        setMessages((prev) => [...prev, botMessage]);
        setRecommendations(data.recommendations || []);
        setHasRecommenderHistory(true);
      } else {
        throw new Error(data.detail || "Failed to get response");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleRecommendationClick = async (
    displayText,
    originalEnglishText
  ) => {
    if (displayText === "go_back") {
      try {
        const response = await fetch(`${API_BASE_URL}/recommendations/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "go_back",
            user_language: selectedLanguage,
          }),
        });
        const data = await response.json();
        if (response.ok) {
          setRecommendations(data.recommendations || []);
          if (!data.recommendations || data.recommendations.length === 0)
            setHasRecommenderHistory(false);
        }
      } catch (error) {
        console.error("Error going back:", error);
      }
      return;
    }

    setIsLoading(true);
    setMessages((prev) => [...prev, { role: "user", content: displayText }]);
    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: originalEnglishText,
          user_language: selectedLanguage,
          chat_history: messages,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.answer },
        ]);
        setRecommendations(data.recommendations || []);
        setHasRecommenderHistory(true);
      } else {
        throw new Error(data.detail || "Failed to get response");
      }
    } catch (error) {
      console.error("Error sending recommendation:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  // ---- NEW FUNCTION FOR "MORE QUESTIONS" ----
  const handleMoreQuestionsClick = async () => {
    setIsLoading(true); // Use the main loading state to prevent other actions
    try {
      const response = await fetch(`${API_BASE_URL}/recommendations/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "get_more",
          user_language: selectedLanguage,
        }),
      });
      const data = await response.json();
      if (response.ok && data.recommendations) {
        // Append the new questions to the existing list
        setRecommendations((prev) => [...prev, ...data.recommendations]);
      } else {
        throw new Error(data.detail || "Failed to get more questions");
      }
    } catch (error) {
      console.error("Error fetching more questions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLanguageChange = (langCode, langName) => {
    setSelectedLanguage(langCode);
    setSelectedLanguageName(langName);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="min-h-screen bg-slate-800 text-white flex">
      {/* Slide-in Sidebar */}
      <div
        className={`fixed top-0 left-0 h-full bg-slate-700 border-r border-slate-600 flex flex-col transition-all duration-300 z-40 ${
          isSidebarOpen ? "w-80" : "w-0 overflow-hidden"
        }`}
      >
        <div className="p-4 border-b border-slate-600 flex justify-end">
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="text-slate-300 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
        </div>

        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="text-slate-300" size={20} />
            <h2 className="text-lg font-medium text-white">
              Select Your Language
            </h2>
          </div>
          <select
            value={selectedLanguageName}
            onChange={(e) => {
              const langName = e.target.value;
              const langCode = languages[langName];
              if (langCode) handleLanguageChange(langCode, langName);
            }}
            className="w-full p-3 bg-slate-600 border border-slate-500 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {Object.keys(languages).map((langName) => (
              <option key={langName} value={langName} className="bg-slate-600">
                {langName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Sidebar handle */}
      {!isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(true)}
          className="fixed top-6 left-0 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-r-lg cursor-pointer z-50 transition-all duration-300"
        >
          <ArrowRight size={20} />
        </div>
      )}

      {/* Main Chat Area */}
      <div
        className={`flex-1 h-screen flex flex-col bg-slate-800 transition-all duration-300 ${
          isSidebarOpen ? "ml-80" : "ml-0"
        }`}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-600 flex-shrink-0">
          <h1 className="text-3xl font-bold text-white mb-2">
            🌾 Sat2Farm AI Assistant
          </h1>
          <p className="text-slate-300">
            Ask me anything about Sat2Farm, or select a recommended question
            below.
          </p>
        </div>

        {/* Scrolling Wrapper for Messages and Recommendations */}
        <div className="flex-1 overflow-y-auto">
          {/* Chat Messages */}
          <div className="p-6">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-slate-400">
                  <MessageCircle
                    size={64}
                    className="mx-auto mb-4 text-slate-500"
                  />
                  <h2 className="text-xl font-medium mb-2 text-slate-300">
                    Welcome to Sat2Farm AI!
                  </h2>
                  <p className="text-lg">
                    Ask me a question or select one from the frequently asked
                    questions below.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 max-w-4xl mx-auto">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-2xl px-6 py-4 rounded-2xl ${
                        message.role === "user"
                          ? "bg-blue-600 text-white ml-12"
                          : "bg-slate-700 text-slate-200 mr-12"
                      }`}
                    >
                      <p className="leading-relaxed">{message.content}</p>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-700 text-slate-200 max-w-2xl px-6 py-4 rounded-2xl mr-12">
                      <div className="flex space-x-2">
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                        <div
                          className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                          style={{ animationDelay: "0.1s" }}
                        ></div>
                        <div
                          className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                          style={{ animationDelay: "0.2s" }}
                        ></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* FAQ / Recommendations */}
          <div className="border-t border-slate-600 bg-slate-750">
            <div className="p-6 max-w-4xl mx-auto">
              <h3 className="text-lg font-medium text-white mb-4">
                Frequently Asked Questions:
              </h3>
              {!isInitialized || isTranslating ? (
                <div className="flex justify-center items-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
                  {isTranslating && (
                    <span className="ml-2 text-slate-400">Translating...</span>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {hasRecommenderHistory && (
                    <button
                      onClick={() => handleRecommendationClick("go_back")}
                      className="p-4 text-left bg-slate-600 hover:bg-slate-500 rounded-xl transition-all duration-200 flex items-center gap-2 text-slate-200"
                    >
                      <ArrowLeft size={16} />
                      Back to previous questions
                    </button>
                  )}

                  {translatedRecommendations.map((translatedRec, index) => (
                    <button
                      key={index}
                      onClick={() =>
                        handleRecommendationClick(
                          translatedRec,
                          recommendations[index]
                        )
                      }
                      className="p-4 text-left bg-slate-600 hover:bg-slate-500 rounded-xl transition-all duration-200 text-slate-200 text-sm leading-relaxed flex items-center justify-start gap-2"
                      disabled={isLoading}
                    >
                      {translatingIndex === index ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        translatedRec
                      )}
                    </button>
                  ))}

                  {/* ---- NEW "MORE QUESTIONS" BUTTON ---- */}
                  {recommendations.length > 0 && (
                    <button
                      onClick={handleMoreQuestionsClick}
                      className="p-4 text-left bg-slate-600 hover:bg-slate-500 rounded-xl transition-all duration-200 text-slate-200 text-sm leading-relaxed flex items-center justify-start gap-2"
                      disabled={isLoading}
                    >
                      More Questions...
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Chat Input */}
        <div className="p-6 border-t border-slate-600 flex-shrink-0">
          <div className="max-w-4xl mx-auto flex gap-4">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your question here..."
              className="flex-1 p-4 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
            />
            <button
              onClick={() => sendMessage()}
              disabled={isLoading || !inputValue.trim()}
              className="px-6 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-xl transition-colors duration-200 flex items-center gap-2"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatBot;
