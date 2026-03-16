"use client"

import { useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Card } from "@/components/ui/card"
import {
    MoreVertical,
    Search,
    FileText,
    Smile,
    Send,
    Bot,
    MessageCircle,
    Zap,
    Sparkles
} from "lucide-react"
import { Streamdown } from "streamdown"

type ChatMessage = {
    id: string
    role: "user" | "ai" | "sav"
    content: string
    createdAt: string
}

type BackendChatMessage = {
    id?: number | string
    type_envoyeur: "user" | "ai" | "sav"
    contenu?: string | null
    date_creation?: string | null
}

function makeId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

const SUGGESTIONS = [
    { 
        title: "Analyser les sentiments", 
        desc: "Le client est-il satisfait ?", 
        icon: <Smile className="h-4 w-4 text-amber-500" />,
        prompt: "Peux-tu analyser le sentiment dominant dans cette conversation ?"
    },
    { 
        title: "Résumé du ticket", 
        desc: "Synthèse des points clés", 
        icon: <FileText className="h-4 w-4 text-blue-500" />,
        prompt: "Fais-moi un résumé court et précis de ce ticket client."
    },
    { 
        title: "Réponse suggérée", 
        desc: "Générer une réponse type", 
        icon: <MessageCircle className="h-4 w-4 text-emerald-500" />,
        prompt: "Génère une réponse professionnelle et empathique pour ce client."
    },
    { 
        title: "Actions suivantes", 
        desc: "Quoi faire après ?", 
        icon: <Zap className="h-4 w-4 text-purple-500" />,
        prompt: "Quelles sont les prochaines étapes recommandées pour résoudre ce problème ?"
    },
];

export default function AiAssistantPage() {
    const params = useParams()
    const sessionId = Array.isArray(params.id) ? params.id[0] : params.id
    const sessionIdNumber = Number(sessionId)

    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [input, setInput] = useState("")
    const [isSending, setIsSending] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [aiEnabled, setAiEnabled] = useState(true)
    const [username, setUsername] = useState("Utilisateur")
    const bottomRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        const storedName = localStorage.getItem("username")
        if (storedName) setUsername(storedName)
    }, [])

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages, isSending])

    useEffect(() => {
        async function loadMessages() {
            if (!Number.isFinite(sessionIdNumber)) return
            try {
                const response = await fetch(
                    `/api/messages?session_id=${sessionIdNumber}`
                )
                if (response.status === 401) {
                    setError("Session expirée. Veuillez vous reconnecter.")
                    return
                }
                if (!response.ok) return
                const data = await response.json()
                if (!Array.isArray(data)) return

                const normalized: ChatMessage[] = (data as BackendChatMessage[]).map((item) => ({
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

    const handleSend = async (event?: React.FormEvent, customPrompt?: string) => {
        event?.preventDefault()
        setError(null)

        const trimmed = (customPrompt ?? input).trim()
        if (!trimmed || isSending) return

        const userMessage: ChatMessage = {
            id: makeId(),
            role: "user",
            content: trimmed,
            createdAt: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
        }

        setMessages(prev => [...prev, userMessage])
        setInput("")

        if (!aiEnabled) {
            try {
                if (!Number.isFinite(sessionIdNumber)) {
                    setError("Session invalide.")
                    return
                }
                const response = await fetch("/api/messages", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        id_session: sessionIdNumber,
                        type_envoyeur: "user",
                        contenu: trimmed
                    })
                })
                if (!response.ok) {
                    if (response.status === 401) {
                        setError("Session expirée. Veuillez vous reconnecter.")
                        return
                    }
                    const data = await response.json()
                    setError(data?.detail || "Erreur lors de l'enregistrement du message.")
                }
            } catch {
                setError("Impossible de contacter le serveur.")
            }
            return
        }

        setIsSending(true)

        const streamId = makeId()
        const now = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
        setMessages(prev => [...prev, { id: streamId, role: "ai", content: "", createdAt: now }])

        try {
            if (!Number.isFinite(sessionIdNumber)) {
                setError("Session invalide.")
                setIsSending(false)
                return
            }

            const response = await fetch(
                `/api/ask?question=${encodeURIComponent(trimmed)}&session_id=${sessionIdNumber}&mode=rag_llm`,
                {
                    method: "POST",
                    credentials: "include",
                }
            )

            if (!response.ok || !response.body) {
                setError("Erreur de l'assistant IA.")
                setIsSending(false)
                return
            }

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let accumulated = ""

            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                accumulated += decoder.decode(value, { stream: true })
                setMessages(prev =>
                    prev.map(m => m.id === streamId ? { ...m, content: accumulated } : m)
                )
            }
        } catch {
            setError("Erreur de connexion au serveur.")
        } finally {
            setIsSending(false)
        }
    }

    return (
        <div className="flex flex-col h-full bg-slate-50/30">
            <header className="h-16 border-b bg-white flex items-center justify-between px-6 shrink-0 shadow-sm">
                <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border-2 border-primary/10">
                        <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">{username.slice(0,2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                        <h2 className="font-bold text-sm text-slate-800">{username} <span className="text-slate-400 font-normal ml-1">#S{sessionId}</span></h2>
                        <p className="text-[11px] text-green-600 font-medium flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></span> Assistant IA Actif
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="text-slate-400"><Search className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="text-slate-400"><MoreVertical className="h-4 w-4" /></Button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto space-y-10">
                        <div className="text-center space-y-4">
                            <div className="bg-indigo-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-xl shadow-indigo-100 mb-6">
                                <Bot className="h-9 w-9 text-white" />
                            </div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Prêt à booster votre SAV ?</h1>
                            <p className="text-slate-500 text-sm max-w-sm mx-auto">Choisissez une action rapide ou posez votre question ci-dessous.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full px-4">
                            {SUGGESTIONS.map((s, i) => (
                                <Card key={i} onClick={() => handleSend(undefined, s.prompt)} className="p-4 border-2 border-slate-100 hover:border-indigo-500 hover:shadow-lg transition-all cursor-pointer group bg-white">
                                    <div className="flex items-start gap-4">
                                        <div className="p-3 rounded-xl bg-slate-50 group-hover:bg-indigo-50 transition-colors">{s.icon}</div>
                                        <div>
                                            <div className="font-bold text-sm text-slate-800 group-hover:text-indigo-600 transition-colors">{s.title}</div>
                                            <div className="text-[11px] text-slate-400">{s.desc}</div>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 max-w-4xl mx-auto">
                        {messages.map((m) => (
                            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[80%] space-y-1 ${m.role === "user" ? "items-end" : "items-start"}`}>
                                    <div className={`rounded-2xl px-5 py-3 text-sm shadow-sm ${m.role === "user" ? "bg-indigo-600 text-white" : "bg-white border-2 border-slate-100 text-slate-700"}`}>
                                        {m.role === "user" ? (
                                            m.content
                                        ) : m.content ? (
                                            <Streamdown animated isAnimating={isSending && messages[messages.length - 1]?.id === m.id}>
                                                {m.content}
                                            </Streamdown>
                                        ) : (
                                            <span className="inline-flex gap-1 items-center text-slate-400">
                                                <span className="h-1.5 w-1.5 rounded-full bg-slate-300 animate-bounce [animation-delay:0ms]" />
                                                <span className="h-1.5 w-1.5 rounded-full bg-slate-300 animate-bounce [animation-delay:150ms]" />
                                                <span className="h-1.5 w-1.5 rounded-full bg-slate-300 animate-bounce [animation-delay:300ms]" />
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-bold px-2 uppercase tracking-tighter">
                                        {m.role === "user" ? username : "Assistant IA"} • {m.createdAt}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            <div className="p-6 bg-white border-t border-slate-100 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
                <div className="max-w-4xl mx-auto space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                            <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} className="data-[state=checked]:bg-indigo-600" />
                            <span className="text-[11px] font-bold text-slate-500 uppercase">IA Active</span>
                        </div>
                        <Badge variant="outline" className="text-indigo-600 border-indigo-100 gap-1 text-[10px] py-1">
                            <Sparkles className="h-3 w-3" /> Chiffrement actif
                        </Badge>
                    </div>
                    <form onSubmit={handleSend} className="relative group">
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Posez votre question à l'assistant..."
                            className="h-14 pl-6 pr-24 rounded-2xl border-2 border-slate-100 focus-visible:ring-indigo-500 bg-slate-50/30 transition-all text-base"
                        />
                        <div className="absolute right-2 top-2 flex items-center gap-1">
                            <Button type="submit" disabled={isSending || !input.trim()} size="sm" className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all">
                                <Send className="h-4 w-4 mr-2" /> {isSending ? "Calcul..." : "Analyser"}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
