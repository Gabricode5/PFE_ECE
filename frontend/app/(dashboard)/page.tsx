"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    Search,
    Bell,
    MessageSquare,
    Zap,
    Clock,
    Star,
    TrendingUp,
    TrendingDown,
    Bot,
    Users,
    Shield,
    MessageCircle
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

type UserItem = {
    id: number
    username: string
    email: string
    role: string
}

type SessionItem = {
    id: number
    title?: string | null
    date_creation?: string | null
}

type MessageItem = {
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

export default function DashboardPage() {
    const router = useRouter()
    const [isCreating, setIsCreating] = useState(false)
    const [role, setRole] = useState("user")
    const [users, setUsers] = useState<UserItem[]>([])
    const [savUsers, setSavUsers] = useState<UserItem[]>([])
    const [selectedUser, setSelectedUser] = useState<UserItem | null>(null)
    const [sessions, setSessions] = useState<SessionItem[]>([])
    const [selectedSession, setSelectedSession] = useState<SessionItem | null>(null)
    const [messages, setMessages] = useState<MessageItem[]>([])
    const [reply, setReply] = useState("")
    const [adminError, setAdminError] = useState<string | null>(null)
    const [isLoadingAdmin, setIsLoadingAdmin] = useState(false)
    const [userSessions, setUserSessions] = useState<SessionItem[]>([])
    const [userQuery, setUserQuery] = useState("")
    const [isLoadingUser, setIsLoadingUser] = useState(false)
    const [userError, setUserError] = useState<string | null>(null)

    useEffect(() => {
        const storedRole = localStorage.getItem("user_role") || "user"
        setRole(storedRole)
    }, [])

    useEffect(() => {
        if (role !== "user") return

        async function loadUserSessions() {
            setIsLoadingUser(true)
            setUserError(null)
            const token = getAuthToken()
            const userId = localStorage.getItem("user_id")
            if (!token || !userId) {
                setUserError("Session expirée. Veuillez vous reconnecter.")
                setIsLoadingUser(false)
                return
            }

            try {
                const response = await fetch(`http://localhost:8000/sessions?user_id=${userId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
                if (!response.ok) {
                    setUserError("Impossible de charger vos conversations.")
                    setIsLoadingUser(false)
                    return
                }
                const data = await response.json()
                setUserSessions(data)
            } catch (error) {
                console.error("Erreur user sessions :", error)
                setUserError("Erreur réseau.")
            } finally {
                setIsLoadingUser(false)
            }
        }

        loadUserSessions()
    }, [role])

    useEffect(() => {
        if (role !== "admin") return

        async function loadAdminData() {
            setIsLoadingAdmin(true)
            setAdminError(null)
            const token = getAuthToken()
            if (!token) {
                setAdminError("Session expirée. Veuillez vous reconnecter.")
                setIsLoadingAdmin(false)
                return
            }

            try {
                const [usersRes, savRes] = await Promise.all([
                    fetch("http://localhost:8000/users?role=user", {
                        headers: { Authorization: `Bearer ${token}` }
                    }),
                    fetch("http://localhost:8000/users?role=sav", {
                        headers: { Authorization: `Bearer ${token}` }
                    })
                ])

                if (!usersRes.ok || !savRes.ok) {
                    setAdminError("Impossible de charger les utilisateurs.")
                    setIsLoadingAdmin(false)
                    return
                }

                const usersData = await usersRes.json()
                const savData = await savRes.json()
                setUsers(usersData)
                setSavUsers(savData)
            } catch (error) {
                console.error("Erreur admin :", error)
                setAdminError("Erreur réseau.")
            } finally {
                setIsLoadingAdmin(false)
            }
        }

        loadAdminData()
    }, [role])

    // Fonction pour créer une nouvelle session de chat
    const handleCreateChat = async () => {
        setIsCreating(true)
        try {
            // On récupère l'ID de l'utilisateur stocké au login
            const userId = localStorage.getItem("user_id")
            
            if (!userId) {
                console.error("ID utilisateur manquant dans le localStorage")
                router.push("/login")
                return
            }

            const token = getAuthToken()
            if (!token) {
                router.push("/login")
                return
            }

            const response = await fetch(`http://localhost:8000/sessions?user_id=${userId}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ title: "Nouvelle discussion" }),
            })

            if (response.ok) {
                const newSession = await response.json()
                // Redirection vers la page de chat dynamique
                router.push(`/ai-assistant/${newSession.id}`)
            } else {
                console.error("Échec de la création de la session")
            }
        } catch (error) {
            console.error("Erreur réseau :", error)
        } finally {
            setIsCreating(false)
        }
    }

    const handleSelectUser = async (userItem: UserItem) => {
        setSelectedUser(userItem)
        setSelectedSession(null)
        setMessages([])
        setAdminError(null)

        const token = getAuthToken()
        if (!token) {
            setAdminError("Session expirée. Veuillez vous reconnecter.")
            return
        }

        try {
            const response = await fetch(`http://localhost:8000/sessions?user_id=${userItem.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            if (!response.ok) {
                setAdminError("Impossible de charger les sessions.")
                return
            }
            const data = await response.json()
            setSessions(data)
        } catch (error) {
            console.error("Erreur sessions :", error)
            setAdminError("Erreur réseau.")
        }
    }

    const handleSelectSession = async (sessionItem: SessionItem) => {
        setSelectedSession(sessionItem)
        setMessages([])
        setAdminError(null)

        const token = getAuthToken()
        if (!token) {
            setAdminError("Session expirée. Veuillez vous reconnecter.")
            return
        }

        try {
            const response = await fetch(`http://localhost:8000/messages?session_id=${sessionItem.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            if (!response.ok) {
                setAdminError("Impossible de charger les messages.")
                return
            }
            const data = await response.json()
            const normalized: MessageItem[] = data.map((item: any) => ({
                id: String(item.id),
                role: item.type_envoyeur,
                content: item.contenu ?? "",
                createdAt: item.date_creation
                    ? new Date(item.date_creation).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
                    : ""
            }))
            setMessages(normalized)
        } catch (error) {
            console.error("Erreur messages :", error)
            setAdminError("Erreur réseau.")
        }
    }

    const handleReply = async () => {
        const trimmed = reply.trim()
        if (!trimmed || !selectedSession) return

        const token = getAuthToken()
        if (!token) {
            setAdminError("Session expirée. Veuillez vous reconnecter.")
            return
        }

        try {
            const response = await fetch("http://localhost:8000/messages", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    id_session: selectedSession.id,
                    type_envoyeur: "sav",
                    contenu: trimmed
                })
            })
            if (!response.ok) {
                const data = await response.json()
                setAdminError(data?.detail || "Impossible d'envoyer la réponse.")
                return
            }
            const data = await response.json()
            const newMessage: MessageItem = {
                id: String(data.id),
                role: "sav",
                content: data.contenu ?? trimmed,
                createdAt: data.date_creation
                    ? new Date(data.date_creation).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
                    : ""
            }
            setMessages((prev) => [...prev, newMessage])
            setReply("")
        } catch (error) {
            console.error("Erreur reply :", error)
            setAdminError("Erreur réseau.")
        }
    }

    if (role === "admin") {
        return (
            <div className="flex flex-col min-h-full">
                <header className="flex items-center justify-between px-8 py-5 bg-background border-b sticky top-0 z-10">
                    <div className="flex items-center gap-4">
                        <h1 className="text-2xl font-bold tracking-tight">Espace Admin</h1>
                        <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100/80 border-0 gap-1 pl-1 pr-2">
                            <Shield className="h-3 w-3" />
                            Admin
                        </Badge>
                    </div>
                </header>

                <div className="p-8 space-y-6 max-w-7xl mx-auto w-full">
                    {adminError ? (
                        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                            {adminError}
                        </div>
                    ) : null}

                    <div className="grid gap-6 lg:grid-cols-3">
                        <Card className="lg:col-span-1">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    Utilisateurs
                                </CardTitle>
                                <CardDescription>Liste des comptes clients.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2 max-h-[420px] overflow-y-auto">
                                {isLoadingAdmin ? (
                                    <div className="text-sm text-muted-foreground">Chargement...</div>
                                ) : users.length === 0 ? (
                                    <div className="text-sm text-muted-foreground">Aucun utilisateur.</div>
                                ) : (
                                    users.map((u) => (
                                        <button
                                            key={u.id}
                                            onClick={() => handleSelectUser(u)}
                                            className={`w-full text-left rounded-md px-3 py-2 border ${selectedUser?.id === u.id ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted/40"}`}
                                        >
                                            <div className="text-sm font-medium">{u.username}</div>
                                            <div className="text-xs text-muted-foreground">{u.email}</div>
                                        </button>
                                    ))
                                )}
                            </CardContent>
                        </Card>

                        <Card className="lg:col-span-1">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Shield className="h-4 w-4" />
                                    Utilisateurs SAV
                                </CardTitle>
                                <CardDescription>Agents de support.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2 max-h-[420px] overflow-y-auto">
                                {isLoadingAdmin ? (
                                    <div className="text-sm text-muted-foreground">Chargement...</div>
                                ) : savUsers.length === 0 ? (
                                    <div className="text-sm text-muted-foreground">Aucun agent SAV.</div>
                                ) : (
                                    savUsers.map((u) => (
                                        <div key={u.id} className="rounded-md px-3 py-2 border border-muted/40">
                                            <div className="text-sm font-medium">{u.username}</div>
                                            <div className="text-xs text-muted-foreground">{u.email}</div>
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>

                        <Card className="lg:col-span-1">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <MessageCircle className="h-4 w-4" />
                                    Conversations
                                </CardTitle>
                                <CardDescription>
                                    {selectedUser ? `Sessions de ${selectedUser.username}` : "Sélectionne un utilisateur."}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2 max-h-[420px] overflow-y-auto">
                                {selectedUser && sessions.length === 0 ? (
                                    <div className="text-sm text-muted-foreground">Aucune session.</div>
                                ) : (
                                    sessions.map((s) => (
                                        <button
                                            key={s.id}
                                            onClick={() => handleSelectSession(s)}
                                            className={`w-full text-left rounded-md px-3 py-2 border ${selectedSession?.id === s.id ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted/40"}`}
                                        >
                                            <div className="text-sm font-medium">{s.title || "Sans titre"}</div>
                                            <div className="text-xs text-muted-foreground">Session #{s.id}</div>
                                        </button>
                                    ))
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Répondre à un utilisateur</CardTitle>
                            <CardDescription>
                                {selectedSession ? `Session #${selectedSession.id}` : "Sélectionne une session pour répondre."}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="max-h-[360px] overflow-y-auto space-y-3 border rounded-md p-3">
                                {messages.length === 0 ? (
                                    <div className="text-sm text-muted-foreground">Aucun message.</div>
                                ) : (
                                    messages.map((m) => (
                                        <div
                                            key={m.id}
                                            className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}
                                        >
                                            <div
                                                className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm ${
                                                    m.role === "user"
                                                        ? "bg-muted/40"
                                                        : m.role === "sav"
                                                        ? "bg-emerald-600 text-white"
                                                        : "bg-primary text-primary-foreground"
                                                }`}
                                            >
                                                <div className="text-[10px] uppercase tracking-wide opacity-80">
                                                    {m.role === "user" ? "Utilisateur" : m.role === "sav" ? "Agent" : "IA"}
                                                </div>
                                                <div className="mt-1">{m.content}</div>
                                                <div className="mt-1 text-[10px] opacity-70">{m.createdAt}</div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="flex gap-2">
                                <Input
                                    value={reply}
                                    onChange={(event) => setReply(event.target.value)}
                                    placeholder="Réponse agent..."
                                    disabled={!selectedSession}
                                />
                                <Button onClick={handleReply} disabled={!selectedSession || !reply.trim()}>
                                    Envoyer
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        )
    }

    const filteredSessions = userSessions.filter((session) => {
        if (!userQuery.trim()) return true
        const title = (session.title || "Nouvelle conversation").toLowerCase()
        return title.includes(userQuery.toLowerCase())
    })

    return (
        <div className="flex flex-col min-h-full">
            {/* Header Bar */}
            <header className="flex items-center justify-between px-8 py-5 bg-background border-b sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
                    <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100/80 border-0 gap-1 pl-1 pr-2">
                        <span className="h-2 w-2 rounded-full bg-green-600 animate-pulse" />
                        IA Active
                    </Badge>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative w-96 hidden md:block">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Rechercher des conversations..."
                            value={userQuery}
                            onChange={(event) => setUserQuery(event.target.value)}
                            className="pl-9 bg-muted/20 border-muted-foreground/20 focus-visible:ring-offset-0 focus-visible:bg-background transition-colors"
                        />
                    </div>

                    <Button variant="ghost" size="icon" className="relative">
                        <Bell className="h-5 w-5" />
                        <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive border-2 border-background" />
                    </Button>
                </div>
            </header>

            <div className="p-8 space-y-8 max-w-7xl mx-auto w-full">
                {userError ? (
                    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                        {userError}
                    </div>
                ) : null}

                {/* KPI Metrics Grid */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    {/* Card 1: Total Conversations */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Total Conversations</CardTitle>
                            <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{userSessions.length}</div>
                            <p className="text-xs text-muted-foreground flex items-center mt-1">
                                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                                <span className="text-green-500 font-medium">Activité personnelle</span>
                            </p>
                        </CardContent>
                    </Card>

                    {/* Card 2: AI Resolution Rate */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Taux de résolution IA</CardTitle>
                            <Zap className="h-4 w-4 text-yellow-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">—</div>
                            <p className="text-xs text-muted-foreground flex items-center mt-1">
                                <span className="text-muted-foreground">Statistiques globales masquées</span>
                            </p>
                        </CardContent>
                    </Card>

                    {/* Card 3: Average Response Time */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Temps de réponse moyen</CardTitle>
                            <Clock className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">—</div>
                            <p className="text-xs text-muted-foreground flex items-center mt-1">
                                <span className="text-muted-foreground">Données indisponibles</span>
                            </p>
                        </CardContent>
                    </Card>

                    {/* Card 4: Customer Satisfaction */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Satisfaction Client</CardTitle>
                            <Star className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">—</div>
                            <p className="text-xs text-muted-foreground flex items-center mt-1">
                                <span className="text-muted-foreground">Données indisponibles</span>
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Content Section: Activity Feed & AI Panel */}
                <div className="grid gap-6 lg:grid-cols-7">

                    {/* Recent Activity Feed */}
                    <Card className="col-span-4 lg:col-span-5">
                        <CardHeader>
                            <CardTitle>Vos conversations</CardTitle>
                            <CardDescription>
                                Vos discussions personnelles uniquement.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-6">
                                {isLoadingUser ? (
                                    <div className="text-sm text-muted-foreground">Chargement...</div>
                                ) : filteredSessions.length === 0 ? (
                                    <div className="text-sm text-muted-foreground">Aucune conversation.</div>
                                ) : (
                                    filteredSessions.map((session) => (
                                        <button
                                            key={session.id}
                                            onClick={() => router.push(`/ai-assistant/${session.id}`)}
                                            className="w-full flex items-center justify-between rounded-md border border-transparent hover:border-muted hover:bg-muted/30 px-3 py-2 transition"
                                        >
                                            <div className="flex items-center gap-4">
                                                <Avatar className="h-10 w-10 border">
                                                    <AvatarFallback>
                                                        {(session.title || "NC").substring(0, 2).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="text-left">
                                                    <p className="text-sm font-medium leading-none">
                                                        {session.title || "Nouvelle conversation"}
                                                    </p>
                                                    <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                                                        Session #{session.id}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                    {session.date_creation
                                                        ? new Date(session.date_creation).toLocaleDateString("fr-FR")
                                                        : "—"}
                                                </span>
                                                <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/15 border-0">
                                                    <Bot className="h-3 w-3 mr-1" />
                                                    IA Autonome
                                                </Badge>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* AI Assistant Action Panel */}
                    <Card className="col-span-4 lg:col-span-2 flex flex-col bg-gradient-to-b from-primary/5 to-background border-primary/20">
                        <CardHeader className="text-center pb-2">
                            <div className="mx-auto bg-primary/10 p-3 rounded-full mb-2 w-fit">
                                <Bot className="h-8 w-8 text-primary" />
                            </div>
                            <CardTitle>Assistant Virtuel</CardTitle>
                            <CardDescription>En ligne et prêt à aider</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col items-center justify-center space-y-4 text-center">
                            <div className="space-y-1">
                                <div className="text-3xl font-bold tracking-tighter">98.5%</div>
                                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Précision actuelle</div>
                            </div>
                            <p className="text-sm text-muted-foreground px-4">
                                L&apos;IA gère actuellement la majorité des requêtes entrantes avec succès.
                            </p>
                        </CardContent>
                        <CardContent className="pt-0">
                            {/* BOUTON CONNECTÉ À L'API */}
                            <Button 
                                className="w-full" 
                                size="lg" 
                                onClick={handleCreateChat}
                                disabled={isCreating}
                            >
                                {isCreating ? "Création en cours..." : "Démarrer une conversation de test"}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
