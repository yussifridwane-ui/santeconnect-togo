"use client";

import { useState, useEffect } from "react";
import {
  Search,
  Send,
  Loader2,
  Mail,
  Star,
  Inbox,
  Archive,
  X,
  Reply,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Message {
  id: number;
  senderId: number;
  receiverId: number;
  facilityId: number | null;
  subject: string;
  content: string;
  status: string;
  isSystemMessage: boolean;
  createdAt: string;
  senderName: string;
  facilityName: string;
}

interface User {
  id: number;
  fullName: string;
  email: string;
}

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState<User[]>([]);

  const [composeData, setComposeData] = useState({
    receiverId: "",
    subject: "",
    content: "",
  });

  useEffect(() => {
    fetchMessages();
    fetchUsers();
  }, []);

  const fetchMessages = async () => {
    try {
      const res = await fetch("/api/messages");
      const data = await res.json();
      setMessages(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const [patientsRes, doctorsRes] = await Promise.all([
        fetch("/api/patients"),
        fetch("/api/doctors"),
      ]);
      const [patients, doctors] = await Promise.all([
        patientsRes.json(),
        doctorsRes.json(),
      ]);
      setUsers([...patients.map((p: any) => ({ id: p.userId, fullName: p.fullName, email: p.email })), ...doctors]);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelect = async (msg: Message) => {
    setSelectedMessage(msg);
    if (msg.status === "unread") {
      await fetch(`/api/messages/${msg.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "read" }),
      });
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id ? { ...m, status: "read" } : m
        )
      );
    }
  };

  const handleCompose = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderId: 1, // Should be from session
          receiverId: parseInt(composeData.receiverId),
          subject: composeData.subject,
          content: composeData.content,
        }),
      });
      setComposeData({ receiverId: "", subject: "", content: "" });
      setShowCompose(false);
      fetchMessages();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = messages.filter(
    (m) =>
      m.subject?.toLowerCase().includes(search.toLowerCase()) ||
      m.senderName?.toLowerCase().includes(search.toLowerCase()) ||
      m.content?.toLowerCase().includes(search.toLowerCase())
  );

  const unreadCount = messages.filter((m) => m.status === "unread").length;
  const receivedMessages = filtered.filter(
    (m) => m.receiverId === 1 || m.senderId !== 1
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Messagerie</h1>
          <p className="text-gray-500 mt-1">
            Communication avec les patients et le personnel
          </p>
        </div>
        <button
          onClick={() => setShowCompose(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
        >
          <Send size={18} />
          Nouveau Message
        </button>
      </div>

      {/* Search & Stats */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Rechercher un message..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium flex items-center gap-1.5">
            <Inbox size={14} />
            {receivedMessages.length} reçus
          </div>
          {unreadCount > 0 && (
            <div className="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium flex items-center gap-1.5">
              <Star size={14} />
              {unreadCount} non lus
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Message List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">
                Boîte de réception
              </h3>
            </div>
            <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                </div>
              ) : receivedMessages.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Mail size={32} className="mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Aucun message</p>
                </div>
              ) : (
                receivedMessages.map((msg) => (
                  <button
                    key={msg.id}
                    onClick={() => handleSelect(msg)}
                    className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                      selectedMessage?.id === msg.id ? "bg-emerald-50" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                          msg.isSystemMessage
                            ? "bg-blue-100 text-blue-600"
                            : "bg-amber-100 text-amber-600"
                        }`}
                      >
                        {msg.senderName?.charAt(0) || "S"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p
                            className={`text-sm truncate ${
                              msg.status === "unread"
                                ? "font-semibold text-gray-900"
                                : "font-medium text-gray-700"
                            }`}
                          >
                            {msg.senderName || "Système"}
                          </p>
                          {msg.status === "unread" && (
                            <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {msg.subject}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {msg.createdAt
                            ? format(new Date(msg.createdAt), "dd MMM HH:mm", {
                                locale: fr,
                              })
                            : ""}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Message Detail */}
        <div className="lg:col-span-2">
          {selectedMessage ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="p-6 border-b border-gray-100 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {selectedMessage.subject}
                  </h3>
                  <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                    <span>
                      De:{" "}
                      <span className="font-medium text-gray-700">
                        {selectedMessage.senderName || "Système"}
                      </span>
                    </span>
                    <span>·</span>
                    <span>
                      {format(new Date(selectedMessage.createdAt), "dd MMMM yyyy, HH:mm", {
                        locale: fr,
                      })}
                    </span>
                  </div>
                  {selectedMessage.isSystemMessage && (
                    <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 bg-blue-100 text-blue-600 rounded-md text-xs font-medium">
                      <Archive size={12} />
                      Message système
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setSelectedMessage(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-6">
                <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-line">
                  {selectedMessage.content}
                </div>
              </div>
              <div className="p-4 border-t border-gray-100 flex justify-end">
                <button
                  onClick={() => {
                    setComposeData({
                      receiverId: selectedMessage.senderId.toString(),
                      subject: `Re: ${selectedMessage.subject}`,
                      content: "",
                    });
                    setShowCompose(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  <Reply size={16} />
                  Répondre
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
              <Mail size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Sélectionnez un message
              </h3>
              <p className="text-gray-500">
                Cliquez sur un message pour voir son contenu
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Nouveau Message
              </h2>
              <button
                onClick={() => setShowCompose(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCompose} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Destinataire *
                </label>
                <select
                  required
                  value={composeData.receiverId}
                  onChange={(e) =>
                    setComposeData({
                      ...composeData,
                      receiverId: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="">Sélectionner</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({u.email})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Objet *
                </label>
                <input
                  required
                  value={composeData.subject}
                  onChange={(e) =>
                    setComposeData({ ...composeData, subject: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message *
                </label>
                <textarea
                  required
                  rows={6}
                  value={composeData.content}
                  onChange={(e) =>
                    setComposeData({ ...composeData, content: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCompose(false)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Send size={16} />
                  )}
                  Envoyer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
