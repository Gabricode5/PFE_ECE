"use client" // Obligatoire pour l'interactivite

import { useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "next/navigation" // Pour recuperer l'ID
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
    MoreVertical,
    Search,
    FileText,
    User,
    Paperclip,
    Smile,
    Image as ImageIcon,
    Send
} from "lucide-react"

type ChatMessage = {
    id: string
    role: "user" | "ai" | "sav"
    content: string
    createdAt: string
}

function getAuthToken(): string | null {
    const tokenPair = document.cookie
        .split("; ")
        .find((entry) => entry.startsWith("auth_token="))
    if (!tokenPair) return null
    return tokenPair.split("=")[1] || null
}

function makeId() {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID()
    }
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export default function AiAssistantPage() {
    const params = useParams()
    const sessionId = Array.isArray(params.id) ? params.id[0] : params.id // On recupere le "4" de l'URL
    const sessionIdNumber = Number(sessionId)

    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [input, setInput] = useState("")
    const [isSending, setIsSending] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [aiEnabled, setAiEnabled] = useState(true)
    const bottomRef = useRef<HTMLDivElement | null>(null)

    const username = useMemo(() => {
        if (typeof window === "undefined") return "Vous"
        return localStorage.getItem("username") || "Vous"
    }, [])

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages, isSending])

    useEffect(() => {
        if (!Number.isFinite(sessionIdNumber)) return

        async function loadMessages() {
            try {
                const token = getAuthToken()
                if (!token) return
                const response = await fetch(
                    `http://localhost:8000/messages?session_id=${sessionIdNumber}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                )
                if (!response.ok) return
                const data = await response.json()
                if (!Array.isArray(data)) return

                const normalized: ChatMessage[] = data.map((item: any) => ({
                    id: String(item.id ?? makeId()),
                    role: item.type_envoyeur === "ai" ? "ai" : item.type_envoyeur === "sav" ? "sav" : "user",
                    content: item.contenu ?? "",
                    createdAt: item.date_creation
                        ? new Date(item.date_creation).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
                        : new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
                }))
                setMessages(normalized)
            } catch (err) {
                console.error("Erreur chargement messages :", err)
            }
        }

        loadMessages()
    }, [sessionIdNumber])

    async function handleSend(event?: React.FormEvent) {
        event?.preventDefault()
        setError(null)

        const trimmed = input.trim()
        if (!trimmed || isSending) return

        const userMessage: ChatMessage = {
            id: makeId(),
            role: "user",
            content: trimmed,
            createdAt: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
        }

        setMessages((prev) => [...prev, userMessage])
        setInput("")
        if (!aiEnabled) {
            try {
                const token = getAuthToken()
                if (!token) {
                    setError("Session expirée. Veuillez vous reconnecter.")
                    return
                }
                if (!Number.isFinite(sessionIdNumber)) {
                    setError("Session invalide.")
                    return
                }
                const response = await fetch("http://localhost:8000/messages", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        id_session: sessionIdNumber,
                        type_envoyeur: "user",
                        contenu: trimmed
                    })
                })
                if (!response.ok) {
                    const data = await response.json()
                    setError(data?.detail || "Erreur lors de l'enregistrement du message.")
                }
            } catch (err) {
                setError("Impossible de contacter le serveur.")
            }
            return
        }
        setIsSending(true)

        try {
            const token = getAuthToken()
            if (!token) {
                setError("Session expirée. Veuillez vous reconnecter.")
                setIsSending(false)
                return
            }
            if (!Number.isFinite(sessionIdNumber)) {
                setError("Session invalide.")
                setIsSending(false)
                return
            }

            const response = await fetch(
                `http://localhost:8000/ask?question=${encodeURIComponent(trimmed)}&session_id=${sessionIdNumber}`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            )

            const data = await response.json()
            if (!response.ok) {
                setError(data?.detail || data?.error || "Erreur lors de l'appel a l'IA.")
                setIsSending(false)
                return
            }

            const aiText =
                typeof data?.response === "string"
                    ? data.response
                    : typeof data?.message === "string"
                    ? data.message
                    : null

            if (!aiText) {
                setError("Reponse IA invalide.")
                setIsSending(false)
                return
            }

    const aiMessage: ChatMessage = {
        id: makeId(),
        role: "ai",
        content: aiText,
        createdAt: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    }

            setMessages((prev) => [...prev, aiMessage])
        } catch (err) {
            setError("Impossible de contacter le serveur IA.")
        } finally {
            setIsSending(false)
        }
    }

    return (
        <div className="flex flex-col h-full bg-muted/5">
            {/* Chat Header */}
            <header className="h-16 border-b bg-background flex items-center justify-between px-6 shrink-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Avatar className="h-10 w-10">
                            <AvatarImage src="/user-avatar.png" alt="User" />
                            <AvatarFallback>JD</AvatarFallback>
                        </Avatar>
                        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-background"></span>
                    </div>
                    <div>
                        <h2 className="font-semibold text-sm">Jean Dupont (Session #{sessionId})</h2>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                            En ligne • Géré par IA
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="text-muted-foreground">
                        <FileText className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-muted-foreground">
                        <Search className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-muted-foreground">
                        <User className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-muted-foreground">
                        <MoreVertical className="h-5 w-5" />
                    </Button>
                </div>
            </header>

            {/* Conversation Stream */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {messages.length === 0 ? (
                    <div className="text-center text-[10px] text-muted-foreground opacity-50">
                        Debut de la session de chat securisee
                    </div>
                ) : null}

                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                        <div className={`max-w-[70%] space-y-1 ${message.role === "user" ? "items-end" : "items-start"}`}>
                            <div
                                className={`rounded-2xl px-4 py-2 text-sm shadow-sm ${
                                    message.role === "user"
                                        ? "bg-primary text-primary-foreground"
                                        : message.role === "sav"
                                        ? "bg-emerald-600 text-white"
                                        : "bg-background border"
                                }`}
                            >
                                {message.content}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                <span>
                                    {message.role === "user" ? username : message.role === "sav" ? "Agent" : "IA"}
                                </span>
                                <span>•</span>
                                <span>{message.createdAt}</span>
                            </div>
                        </div>
                    </div>
                ))}

                {isSending ? (
                    <div className="flex justify-start">
                        <div className="max-w-[70%] space-y-1">
                            <div className="rounded-2xl px-4 py-2 text-sm shadow-sm bg-background border">
                                IA est en train d'ecrire...
                            </div>
                        </div>
                    </div>
                ) : null}

                <div ref={bottomRef} />
            </div>

            {/* Input Area */}
            <div className="p-6 pt-2 bg-background border-t shrink-0 space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <Switch
                            id="auto-ia"
                            checked={aiEnabled}
                            onCheckedChange={setAiEnabled}
                        />
                        <label htmlFor="auto-ia">Assistant IA actif</label>
                    </div>
                    <Badge variant="secondary">Mode securise</Badge>
                </div>

                {error ? (
                    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                        {error}
                    </div>
                ) : null}

                <form onSubmit={handleSend} className="flex items-center gap-2">
                    <Button type="button" variant="ghost" size="icon" className="text-muted-foreground">
                        <Paperclip className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="text-muted-foreground">
                        <ImageIcon className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="text-muted-foreground">
                        <Smile className="h-4 w-4" />
                    </Button>

                    <Input
                        value={input}
                        onChange={(event) => setInput(event.target.value)}
                        placeholder="Ecrivez votre message..."
                        className="flex-1"
                    />

                    <Button type="submit" disabled={isSending || !input.trim()} className="gap-2">
                        <Send className="h-4 w-4" />
                        {aiEnabled ? "Envoyer" : "Envoyer (IA off)"}
                    </Button>
                </form>
            </div>
        </div>
    )
}
