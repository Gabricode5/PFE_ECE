"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    Search,
    MessageSquare,
    Zap,
    Clock,
    Star,
    TrendingUp,
    Bot,
    Users,
    Shield,
    MessageCircle,
    UserCheck,
    UserX,
    Pencil,
    Trash2,
    ChevronRight,
    Send,
    UserCog,
    Crown,
    Headphones,
    CircleDot,
    CheckCircle2
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

type UserItem = {
    id: number
    username: string
    email: string
    prenom?: string | null
    nom?: string | null
    role: string
}

type SessionItem = {
    id: number
    title?: string | null
    date_creation?: string | null
    status?: string | null
}

type MessageItem = {
    id: string
    role: "user" | "ai" | "sav"
    content: string
    createdAt: string
}

type BackendMessageItem = {
    id: number | string
    type_envoyeur: "user" | "ai" | "sav"
    contenu?: string | null
    date_creation?: string | null
}

export default function DashboardPage() {
    const router = useRouter()
    const [role, setRole] = useState("user")
    const [users, setUsers] = useState<UserItem[]>([])
    const [savUsers, setSavUsers] = useState<UserItem[]>([])
    const [adminUsers, setAdminUsers] = useState<UserItem[]>([])
    const [selectedUser, setSelectedUser] = useState<UserItem | null>(null)
    const [sessions, setSessions] = useState<SessionItem[]>([])
    const [selectedSession, setSelectedSession] = useState<SessionItem | null>(null)
    const [messages, setMessages] = useState<MessageItem[]>([])
    const [reply, setReply] = useState("")
    const [adminError, setAdminError] = useState<string | null>(null)
    const [isLoadingAdmin, setIsLoadingAdmin] = useState(false)
    const [updatingRoleUserId, setUpdatingRoleUserId] = useState<number | null>(null)
    const [updatingUserId, setUpdatingUserId] = useState<number | null>(null)
    const [userSessions, setUserSessions] = useState<SessionItem[]>([])
    const [userQuery, setUserQuery] = useState("")
    const [isLoadingUser, setIsLoadingUser] = useState(false)
    const [userError, setUserError] = useState<string | null>(null)
    const [currentUserId, setCurrentUserId] = useState<number | null>(null)
    const [closingSessionId, setClosingSessionId] = useState<number | null>(null)
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [editingUser, setEditingUser] = useState<UserItem | null>(null)
    const [editForm, setEditForm] = useState({ username: "", email: "", prenom: "", nom: "", role: "" })
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [deletingUser, setDeletingUser] = useState<UserItem | null>(null)

    useEffect(() => {
        const storedRole = localStorage.getItem("user_role") || "user"
        const storedUserId = localStorage.getItem("user_id")
        setRole(storedRole)
        setCurrentUserId(storedUserId ? Number(storedUserId) : null)
    }, [])

    useEffect(() => {
        if (role !== "user") return

        async function loadUserSessions() {
            setIsLoadingUser(true)
            setUserError(null)
            const userId = localStorage.getItem("user_id")
            if (!userId) {
                setUserError("Session expirée. Veuillez vous reconnecter.")
                setIsLoadingUser(false)
                return
            }

            try {
                const response = await fetch(`/api/sessions?user_id=${userId}`)
                if (response.status === 401) {
                    setUserError("Session expirée. Veuillez vous reconnecter.")
                    setIsLoadingUser(false)
                    return
                }
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

    const loadAdminData = async () => {
        setIsLoadingAdmin(true)
        setAdminError(null)

        try {
            const [usersRes, savRes, adminsRes] = await Promise.all([
                fetch("/api/users?role=user"),
                fetch("/api/users?role=sav"),
                fetch("/api/users?role=admin")
            ])

            if (usersRes.status === 401 || savRes.status === 401 || adminsRes.status === 401) {
                setAdminError("Session expirée. Veuillez vous reconnecter.")
                setIsLoadingAdmin(false)
                return
            }
            if (!usersRes.ok || !savRes.ok || !adminsRes.ok) {
                setAdminError("Impossible de charger les utilisateurs.")
                setIsLoadingAdmin(false)
                return
            }

            const usersData = await usersRes.json()
            const savData = await savRes.json()
            const adminsData = await adminsRes.json()
            setUsers(usersData)
            setSavUsers(savData)
            setAdminUsers(adminsData)
        } catch (error) {
            console.error("Erreur admin :", error)
            setAdminError("Erreur réseau.")
        } finally {
            setIsLoadingAdmin(false)
        }
    }

    useEffect(() => {
        if (role !== "admin") return
        loadAdminData()
    }, [role])

    const handleChangeUserRole = async (userItem: UserItem, newRole: "user" | "sav" | "admin") => {
        setAdminError(null)
        setUpdatingRoleUserId(userItem.id)
        try {
            const response = await fetch(`/api/users/${userItem.id}/role`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ role: newRole })
            })

            const data = await response.json()
            if (!response.ok) {
                if (response.status === 401) {
                    setAdminError("Session expirée. Veuillez vous reconnecter.")
                    return
                }
                setAdminError(data?.detail || "Impossible de modifier le rôle.")
                return
            }

            if (selectedUser?.id === userItem.id) {
                setSelectedUser((prev) => (prev ? { ...prev, role: data.role } : prev))
            }

            await loadAdminData()
        } catch (error) {
            console.error("Erreur changement rôle :", error)
            setAdminError("Erreur réseau.")
        } finally {
            setUpdatingRoleUserId(null)
        }
    }

    const handleEditUser = (userItem: UserItem) => {
        setEditingUser(userItem)
        setEditForm({
            username: userItem.username,
            email: userItem.email,
            prenom: userItem.prenom || "",
            nom: userItem.nom || "",
            role: userItem.role,
        })
        setEditDialogOpen(true)
    }

    const handleEditSubmit = async () => {
        if (!editingUser) return
        setAdminError(null)
        setUpdatingUserId(editingUser.id)
        try {
            const response = await fetch(`/api/users/${editingUser.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: editForm.username.trim(),
                    email: editForm.email.trim().toLowerCase(),
                    prenom: editForm.prenom.trim(),
                    nom: editForm.nom.trim(),
                    role: editForm.role.trim().toLowerCase(),
                }),
            })

            const data = await response.json()
            if (!response.ok) {
                if (response.status === 401) {
                    setAdminError("Session expirée. Veuillez vous reconnecter.")
                    return
                }
                setAdminError(data?.detail || "Impossible de modifier l'utilisateur.")
                return
            }

            if (selectedUser?.id === editingUser.id) {
                setSelectedUser(data)
            }
            setEditDialogOpen(false)
            await loadAdminData()
        } catch (error) {
            console.error("Erreur update user :", error)
            setAdminError("Erreur réseau.")
        } finally {
            setUpdatingUserId(null)
        }
    }

    const handleDeleteUser = (userItem: UserItem) => {
        setDeletingUser(userItem)
        setDeleteDialogOpen(true)
    }

    const handleDeleteConfirm = async () => {
        if (!deletingUser) return
        const userItem = deletingUser
        setDeleteDialogOpen(false)
        setAdminError(null)
        setUpdatingUserId(userItem.id)
        try {
            const response = await fetch(`/api/users/${userItem.id}`, {
                method: "DELETE"
            })

            if (!response.ok) {
                if (response.status === 401) {
                    setAdminError("Session expirée. Veuillez vous reconnecter.")
                    return
                }
                const data = await response.json()
                setAdminError(data?.detail || "Impossible de supprimer l'utilisateur.")
                return
            }

            if (selectedUser?.id === userItem.id) {
                setSelectedUser(null)
                setSelectedSession(null)
                setSessions([])
                setMessages([])
            }

            await loadAdminData()
        } catch (error) {
            console.error("Erreur suppression user :", error)
            setAdminError("Erreur réseau.")
        } finally {
            setUpdatingUserId(null)
        }
    }

    const handleSelectUser = async (userItem: UserItem) => {
        setSelectedUser(userItem)
        setSelectedSession(null)
        setMessages([])
        setAdminError(null)

        try {
            const response = await fetch(`/api/sessions?user_id=${userItem.id}`)
            if (!response.ok) {
                if (response.status === 401) {
                    setAdminError("Session expirée. Veuillez vous reconnecter.")
                    return
                }
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

        try {
            const response = await fetch(`/api/messages?session_id=${sessionItem.id}`)
            if (!response.ok) {
                if (response.status === 401) {
                    setAdminError("Session expirée. Veuillez vous reconnecter.")
                    return
                }
                setAdminError("Impossible de charger les messages.")
                return
            }
            const data = await response.json()
            const normalized: MessageItem[] = (data as BackendMessageItem[]).map((item) => ({
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

    const handleCloseSession = async (sessionItem: SessionItem) => {
        const confirmed = window.confirm(`Clôturer la session #${sessionItem.id} ?`)
        if (!confirmed) return

        setClosingSessionId(sessionItem.id)
        try {
            const response = await fetch(`/api/sessions/${sessionItem.id}/close`, {
                method: "POST"
            })
            if (!response.ok) {
                const data = await response.json()
                const message = data?.detail || "Impossible de clôturer la session."
                setAdminError(message)
                setUserError(message)
                return
            }

            if (role === "admin" && selectedUser) {
                await handleSelectUser(selectedUser)
            } else {
                const userId = localStorage.getItem("user_id")
                if (userId) {
                    const refresh = await fetch(`/api/sessions?user_id=${userId}`)
                    if (refresh.ok) {
                        const data = await refresh.json()
                        setUserSessions(data)
                    }
                }
            }
        } catch (error) {
            console.error("Erreur clôture session :", error)
            setAdminError("Erreur réseau.")
            setUserError("Erreur réseau.")
        } finally {
            setClosingSessionId(null)
        }
    }

    const handleReply = async () => {
        const trimmed = reply.trim()
        if (!trimmed || !selectedSession) return

        try {
            const response = await fetch("/api/messages", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    id_session: selectedSession.id,
                    type_envoyeur: "sav",
                    contenu: trimmed
                })
            })
            if (!response.ok) {
                if (response.status === 401) {
                    setAdminError("Session expirée. Veuillez vous reconnecter.")
                    return
                }
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
            <>
            <div className="flex flex-col min-h-full bg-slate-50/50">
                {/* Header */}
                <header className="flex items-center justify-between px-8 py-5 bg-white border-b sticky top-0 z-10 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-600 shadow-sm">
                            <UserCog className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight text-slate-900">Espace Admin</h1>
                            <p className="text-xs text-slate-500">Gestion des utilisateurs &amp; conversations</p>
                        </div>
                        <Badge className="bg-indigo-50 text-indigo-700 hover:bg-indigo-50 border border-indigo-200 gap-1 ml-2">
                            <Shield className="h-3 w-3" />
                            Administrateur
                        </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-500">
                        <div className="flex items-center gap-1.5 bg-white border rounded-lg px-3 py-1.5 shadow-sm">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="font-medium text-slate-700">{users.length + savUsers.length + adminUsers.length}</span>
                            <span>utilisateurs</span>
                        </div>
                    </div>
                </header>

                <div className="p-8 space-y-6 max-w-7xl mx-auto w-full">
                    {adminError ? (
                        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                            {adminError}
                        </div>
                    ) : null}

                    {/* User Management Grid */}
                    <div className="grid gap-5 lg:grid-cols-4">

                        {/* Utilisateurs */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                                        <Users className="h-4 w-4 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800">Utilisateurs</p>
                                        <p className="text-xs text-slate-400">Comptes clients</p>
                                    </div>
                                </div>
                                <Badge className="bg-blue-50 text-blue-600 border-blue-100 text-xs font-semibold">
                                    {users.length}
                                </Badge>
                            </div>
                            <div className="divide-y divide-slate-50 max-h-[400px] overflow-y-auto">
                                {isLoadingAdmin ? (
                                    <div className="px-5 py-8 text-center text-sm text-slate-400">Chargement...</div>
                                ) : users.length === 0 ? (
                                    <div className="px-5 py-8 text-center text-sm text-slate-400">Aucun utilisateur</div>
                                ) : (
                                    users.map((u) => (
                                        <div
                                            key={u.id}
                                            className={`px-4 py-3 transition-colors ${selectedUser?.id === u.id ? "bg-blue-50/60" : "hover:bg-slate-50/80"}`}
                                        >
                                            <button onClick={() => handleSelectUser(u)} className="w-full text-left flex items-center gap-3 mb-2.5">
                                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                                    <span className="text-xs font-bold text-blue-600">{u.username.charAt(0).toUpperCase()}</span>
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-sm font-medium text-slate-800 truncate">{u.username}</div>
                                                    <div className="text-xs text-slate-400 truncate">{u.email}</div>
                                                </div>
                                                {selectedUser?.id === u.id && <ChevronRight className="h-4 w-4 text-blue-400 ml-auto flex-shrink-0" />}
                                            </button>
                                            <div className="flex items-center gap-1.5 pl-11">
                                                <button
                                                    onClick={() => handleChangeUserRole(u, "sav")}
                                                    disabled={updatingRoleUserId === u.id}
                                                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors disabled:opacity-50"
                                                >
                                                    <UserCheck className="h-3 w-3" />
                                                    {updatingRoleUserId === u.id ? "..." : "SAV"}
                                                </button>
                                                <button
                                                    onClick={() => handleEditUser(u)}
                                                    disabled={updatingUserId === u.id}
                                                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors disabled:opacity-50"
                                                >
                                                    <Pencil className="h-3 w-3" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteUser(u)}
                                                    disabled={updatingUserId === u.id || currentUserId === u.id}
                                                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-red-50 text-red-500 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-50"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* SAV */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                                        <Headphones className="h-4 w-4 text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800">Agents SAV</p>
                                        <p className="text-xs text-slate-400">Support client</p>
                                    </div>
                                </div>
                                <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 text-xs font-semibold">
                                    {savUsers.length}
                                </Badge>
                            </div>
                            <div className="divide-y divide-slate-50 max-h-[400px] overflow-y-auto">
                                {isLoadingAdmin ? (
                                    <div className="px-5 py-8 text-center text-sm text-slate-400">Chargement...</div>
                                ) : savUsers.length === 0 ? (
                                    <div className="px-5 py-8 text-center text-sm text-slate-400">Aucun agent SAV</div>
                                ) : (
                                    savUsers.map((u) => (
                                        <div
                                            key={u.id}
                                            className={`px-4 py-3 transition-colors ${selectedUser?.id === u.id ? "bg-emerald-50/60" : "hover:bg-slate-50/80"}`}
                                        >
                                            <button onClick={() => handleSelectUser(u)} className="w-full text-left flex items-center gap-3 mb-2.5">
                                                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                                                    <span className="text-xs font-bold text-emerald-600">{u.username.charAt(0).toUpperCase()}</span>
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-sm font-medium text-slate-800 truncate">{u.username}</div>
                                                    <div className="text-xs text-slate-400 truncate">{u.email}</div>
                                                </div>
                                                {selectedUser?.id === u.id && <ChevronRight className="h-4 w-4 text-emerald-400 ml-auto flex-shrink-0" />}
                                            </button>
                                            <div className="flex items-center gap-1.5 pl-11">
                                                <button
                                                    onClick={() => handleChangeUserRole(u, "user")}
                                                    disabled={updatingRoleUserId === u.id}
                                                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-orange-50 text-orange-600 hover:bg-orange-100 border border-orange-200 transition-colors disabled:opacity-50"
                                                >
                                                    <UserX className="h-3 w-3" />
                                                    {updatingRoleUserId === u.id ? "..." : "Retirer"}
                                                </button>
                                                <button
                                                    onClick={() => handleEditUser(u)}
                                                    disabled={updatingUserId === u.id}
                                                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors disabled:opacity-50"
                                                >
                                                    <Pencil className="h-3 w-3" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteUser(u)}
                                                    disabled={updatingUserId === u.id || currentUserId === u.id}
                                                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-red-50 text-red-500 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-50"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Admins */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                                        <Crown className="h-4 w-4 text-indigo-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800">Admins</p>
                                        <p className="text-xs text-slate-400">Administrateurs</p>
                                    </div>
                                </div>
                                <Badge className="bg-indigo-50 text-indigo-600 border-indigo-100 text-xs font-semibold">
                                    {adminUsers.length}
                                </Badge>
                            </div>
                            <div className="divide-y divide-slate-50 max-h-[400px] overflow-y-auto">
                                {isLoadingAdmin ? (
                                    <div className="px-5 py-8 text-center text-sm text-slate-400">Chargement...</div>
                                ) : adminUsers.length === 0 ? (
                                    <div className="px-5 py-8 text-center text-sm text-slate-400">Aucun admin</div>
                                ) : (
                                    adminUsers.map((u) => (
                                        <div
                                            key={u.id}
                                            className={`px-4 py-3 transition-colors ${selectedUser?.id === u.id ? "bg-indigo-50/60" : "hover:bg-slate-50/80"}`}
                                        >
                                            <button onClick={() => handleSelectUser(u)} className="w-full text-left flex items-center gap-3 mb-2.5">
                                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                                    <span className="text-xs font-bold text-indigo-600">{u.username.charAt(0).toUpperCase()}</span>
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-sm font-medium text-slate-800 truncate">{u.username}</div>
                                                    <div className="text-xs text-slate-400 truncate">{u.email}</div>
                                                </div>
                                                {selectedUser?.id === u.id && <ChevronRight className="h-4 w-4 text-indigo-400 ml-auto flex-shrink-0" />}
                                            </button>
                                            <div className="flex items-center gap-1.5 pl-11">
                                                <button
                                                    onClick={() => handleEditUser(u)}
                                                    disabled={updatingUserId === u.id}
                                                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors disabled:opacity-50"
                                                >
                                                    <Pencil className="h-3 w-3" />
                                                    Modifier
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteUser(u)}
                                                    disabled={updatingUserId === u.id || currentUserId === u.id}
                                                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-red-50 text-red-500 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-50"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Conversations */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                                        <MessageCircle className="h-4 w-4 text-violet-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800">Conversations</p>
                                        <p className="text-xs text-slate-400">
                                            {selectedUser ? selectedUser.username : "Sélectionner"}
                                        </p>
                                    </div>
                                </div>
                                {sessions.length > 0 && (
                                    <Badge className="bg-violet-50 text-violet-600 border-violet-100 text-xs font-semibold">
                                        {sessions.length}
                                    </Badge>
                                )}
                            </div>
                            <div className="divide-y divide-slate-50 max-h-[400px] overflow-y-auto">
                                {!selectedUser ? (
                                    <div className="px-5 py-10 text-center">
                                        <MessageCircle className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                                        <p className="text-sm text-slate-400">Sélectionne un utilisateur</p>
                                    </div>
                                ) : sessions.length === 0 ? (
                                    <div className="px-5 py-8 text-center text-sm text-slate-400">Aucune session</div>
                                ) : (
                                    sessions.map((s) => (
                                        <button
                                            key={s.id}
                                            onClick={() => handleSelectSession(s)}
                                            className={`w-full text-left px-4 py-3 transition-colors ${selectedSession?.id === s.id ? "bg-violet-50/70" : "hover:bg-slate-50/80"}`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <div className="text-sm font-medium text-slate-800 truncate">{s.title || "Sans titre"}</div>
                                                    <div className="text-xs text-slate-400 mt-0.5">#{s.id}</div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                                    <div className={`flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full ${s.status === "closed" ? "bg-slate-100 text-slate-500" : "bg-emerald-100 text-emerald-700"}`}>
                                                        {s.status === "closed"
                                                            ? <><CheckCircle2 className="h-2.5 w-2.5" /> Clôturée</>
                                                            : <><CircleDot className="h-2.5 w-2.5" /> Ouverte</>
                                                        }
                                                    </div>
                                                    {s.status !== "closed" && (
                                                        <button
                                                            onClick={(event) => { event.stopPropagation(); handleCloseSession(s) }}
                                                            disabled={closingSessionId === s.id}
                                                            className="text-[11px] px-2 py-0.5 rounded-md bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200 transition-colors disabled:opacity-50"
                                                        >
                                                            {closingSessionId === s.id ? "..." : "Clôturer"}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Reply Panel */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                                <MessageSquare className="h-4 w-4 text-slate-600" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-800">Répondre à un utilisateur</p>
                                <p className="text-xs text-slate-400">
                                    {selectedSession ? `Session #${selectedSession.id} · ${selectedUser?.username}` : "Sélectionne une session pour répondre"}
                                </p>
                            </div>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="min-h-[240px] max-h-[360px] overflow-y-auto space-y-3 rounded-lg bg-slate-50/60 border border-slate-100 p-4">
                                {messages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-40 gap-2">
                                        <MessageSquare className="h-8 w-8 text-slate-200" />
                                        <p className="text-sm text-slate-400">Aucun message</p>
                                    </div>
                                ) : (
                                    messages.map((m) => (
                                        <div
                                            key={m.id}
                                            className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}
                                        >
                                            <div
                                                className={`max-w-[72%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                                                    m.role === "user"
                                                        ? "bg-white border border-slate-200 text-slate-700"
                                                        : m.role === "sav"
                                                        ? "bg-emerald-600 text-white"
                                                        : "bg-indigo-600 text-white"
                                                }`}
                                            >
                                                <div className="text-[10px] uppercase tracking-widest opacity-70 font-medium mb-1">
                                                    {m.role === "user" ? "Client" : m.role === "sav" ? "Agent" : "IA"}
                                                </div>
                                                <div className="leading-relaxed">{m.content}</div>
                                                <div className="mt-1.5 text-[10px] opacity-60 text-right">{m.createdAt}</div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="flex gap-2">
                                <Input
                                    value={reply}
                                    onChange={(event) => setReply(event.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply() } }}
                                    placeholder={selectedSession ? "Écrire une réponse..." : "Sélectionne une session d'abord..."}
                                    disabled={!selectedSession}
                                    className="flex-1 bg-slate-50 border-slate-200 focus-visible:ring-indigo-500/30 placeholder:text-slate-400"
                                />
                                <Button
                                    onClick={handleReply}
                                    disabled={!selectedSession || !reply.trim()}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 px-5"
                                >
                                    <Send className="h-4 w-4" />
                                    Envoyer
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit User Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Modifier l&apos;utilisateur</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="edit-prenom">Prénom</Label>
                                <Input
                                    id="edit-prenom"
                                    value={editForm.prenom}
                                    onChange={(e) => setEditForm((f) => ({ ...f, prenom: e.target.value }))}
                                    placeholder="Prénom"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="edit-nom">Nom</Label>
                                <Input
                                    id="edit-nom"
                                    value={editForm.nom}
                                    onChange={(e) => setEditForm((f) => ({ ...f, nom: e.target.value }))}
                                    placeholder="Nom"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="edit-username">Nom d&apos;utilisateur</Label>
                            <Input
                                id="edit-username"
                                value={editForm.username}
                                onChange={(e) => setEditForm((f) => ({ ...f, username: e.target.value }))}
                                placeholder="username"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="edit-email">Email</Label>
                            <Input
                                id="edit-email"
                                type="email"
                                value={editForm.email}
                                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                                placeholder="email@exemple.com"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="edit-role">Rôle</Label>
                            <Select value={editForm.role} onValueChange={(v) => setEditForm((f) => ({ ...f, role: v }))}>
                                <SelectTrigger id="edit-role">
                                    <SelectValue placeholder="Choisir un rôle" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="user">Utilisateur</SelectItem>
                                    <SelectItem value="sav">Agent SAV</SelectItem>
                                    <SelectItem value="admin">Administrateur</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Annuler</Button>
                        <Button
                            onClick={handleEditSubmit}
                            disabled={updatingUserId === editingUser?.id || !editForm.username.trim() || !editForm.email.trim()}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                            {updatingUserId === editingUser?.id ? "Enregistrement..." : "Enregistrer"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer le compte ?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Vous êtes sur le point de supprimer le compte de{" "}
                            <span className="font-semibold text-slate-800">{deletingUser?.username}</span>{" "}
                            ({deletingUser?.email}). Cette action est irréversible.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteConfirm}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            Supprimer
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            </>
        )
    }

    const filteredSessions = userSessions.filter((session) => {
        if (!userQuery.trim()) return true
        const title = (session.title || "Nouvelle conversation").toLowerCase()
        return title.includes(userQuery.toLowerCase())
    })

    const totalSessions = userSessions.length
    const closedSessions = userSessions.filter((session) => session.status === "closed").length
    const openSessions = totalSessions - closedSessions
    const closureRate = totalSessions > 0 ? `${Math.round((closedSessions / totalSessions) * 100)}%` : "0%"
    const lastSessionDate = userSessions
        .map((session) => session.date_creation)
        .filter((date): date is string => Boolean(date))
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
    const lastActivityLabel = lastSessionDate
        ? new Date(lastSessionDate).toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "short",
        })
        : "Aucune"

    return (
        <div className="flex flex-col min-h-full">
            {/* Header Bar */}
            <header className="flex items-center justify-between px-8 py-5 bg-background border-b sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
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
                            <div className="text-2xl font-bold">{totalSessions}</div>
                            <p className="text-xs text-muted-foreground flex items-center mt-1">
                                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                                <span className="text-green-500 font-medium">Activité personnelle</span>
                            </p>
                        </CardContent>
                    </Card>

                    {/* Card 2: Closure Rate */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Sessions clôturées</CardTitle>
                            <Zap className="h-4 w-4 text-yellow-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{closureRate}</div>
                            <p className="text-xs text-muted-foreground flex items-center mt-1">
                                <span className="text-muted-foreground">{closedSessions} conversation{closedSessions > 1 ? "s" : ""} terminée{closedSessions > 1 ? "s" : ""}</span>
                            </p>
                        </CardContent>
                    </Card>

                    {/* Card 3: Open Sessions */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Conversations ouvertes</CardTitle>
                            <Clock className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{openSessions}</div>
                            <p className="text-xs text-muted-foreground flex items-center mt-1">
                                <span className="text-muted-foreground">Encore en attente de clôture</span>
                            </p>
                        </CardContent>
                    </Card>

                    {/* Card 4: Latest Activity */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Dernière activité</CardTitle>
                            <Star className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{lastActivityLabel}</div>
                            <p className="text-xs text-muted-foreground flex items-center mt-1">
                                <span className="text-muted-foreground">Basé sur la date de vos sessions</span>
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
                                        <div
                                            key={session.id}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => router.push(`/ai-assistant/${session.id}`)}
                                            onKeyDown={(event) => {
                                                if (event.key === "Enter" || event.key === " ") {
                                                    event.preventDefault()
                                                    router.push(`/ai-assistant/${session.id}`)
                                                }
                                            }}
                                            className="w-full flex items-center justify-between rounded-md border border-transparent hover:border-muted hover:bg-muted/30 px-3 py-2 transition cursor-pointer"
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
                                                <Badge variant="secondary" className={`${session.status === "closed" ? "bg-slate-200 text-slate-700" : "bg-emerald-100 text-emerald-700"} border-0`}>
                                                    {session.status === "closed" ? "Clôturée" : "Ouverte"}
                                                </Badge>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={(event) => {
                                                        event.stopPropagation()
                                                        handleCloseSession(session)
                                                    }}
                                                    disabled={closingSessionId === session.id || session.status === "closed"}
                                                >
                                                    {closingSessionId === session.id ? "..." : "Clôturer"}
                                                </Button>
                                                <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/15 border-0">
                                                    <Bot className="h-3 w-3 mr-1" />
                                                    IA Autonome
                                                </Badge>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>

                </div>
            </div>
        </div>
    )
}
