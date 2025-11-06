"use client";
import { useState } from "react";

export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  const sendMessage = () => {
    if (!input.trim()) return;
    setMessages([...messages, input]);
    setInput("");
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1 style={{ fontSize: "20px", fontWeight: "bold", marginBottom: "10px" }}>Mini Chat</h1>
      <div style={{ border: "1px solid #ccc", padding: "10px", height: "250px", overflowY: "auto", marginBottom: "10px" }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ marginBottom: "5px" }}>{msg}</div>
        ))}
      </div>
      <div style={{ display: "flex", gap: "5px" }}>
        <input
          style={{ flex: 1, padding: "5px" }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
        />
        <button style={{ padding: "5px 10px" }} onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}
