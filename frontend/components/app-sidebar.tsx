"use client"

import { useEffect, useState } from "react" // Ajout de ces imports
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import {
    LayoutDashboard,
    BookOpen,
    Bot,
    BarChart2,
    LogOut
} from "lucide-react"

export function AppSidebar() {
    const pathname = usePathname()
    
    // État pour stocker l'utilisateur (valeurs par défaut vides)
    const [user, setUser] = useState({
        username: "Utilisateur",
        email: "chargement...",
        initials: "U"
    })

    useEffect(() => {
        // Récupération des données du localStorage au montage du composant
        const storedUser = localStorage.getItem("username")
        const storedEmail = localStorage.getItem("user_email") || "votre@email.com"

        if (storedUser) {
            setUser({
                username: storedUser,
                email: storedEmail,
                initials: storedUser.substring(0, 2).toUpperCase()
            })
        }
    }, [])

    const isActive = (path: string) => {
        if (path === "/") return pathname === "/"
        return pathname?.startsWith(path)
    }

    const handleLogout = () => {
        // Nettoyage complet
        document.cookie = "auth_token=; path=/; max-age=0; SameSite=Strict"
        document.cookie = "token=; path=/; max-age=0; SameSite=Strict"
        localStorage.removeItem("username")
        localStorage.removeItem("user_email")
        
        window.location.href = "/login"
    }

    return (
        <aside className="w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border hidden md:flex flex-col h-full">
            {/* Logo Area */}
            <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
                <div className="flex items-center gap-2 font-bold text-xl">
                    <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
                        A
                    </div>
                    <span>AI CRM</span>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-y-auto py-6 px-3 space-y-6">
                {/* ... (Reste de votre menu identique) ... */}
                <div>
                    <h3 className="px-4 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2">
                        Menu Principal
                    </h3>
                    <div className="space-y-1">
                        <Button
                            variant={isActive("/") ? "secondary" : "ghost"}
                            asChild
                            className={cn(
                                "w-full justify-start",
                                isActive("/") ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                            )}
                        >
                            <Link href="/">
                                <LayoutDashboard className="mr-3 h-4 w-4" />
                                Tableau de bord
                            </Link>
                        </Button>
                        <Button
                            variant={isActive("/knowledge-base") ? "secondary" : "ghost"}
                            asChild
                            className={cn(
                                "w-full justify-start",
                                isActive("/knowledge-base") ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                            )}
                        >
                            <Link href="/knowledge-base">
                                <BookOpen className="mr-3 h-4 w-4" />
                                Base de connaissances
                            </Link>
                        </Button>
                    </div>
                </div>

                {/* AI Tools */}
                <div>
                    <h3 className="px-4 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2">
                        Outils IA
                    </h3>
                    <div className="space-y-1">
                        <Button
                            variant={isActive("/ai-assistant") ? "secondary" : "ghost"}
                            asChild
                            className={cn(
                                "w-full justify-start",
                                isActive("/ai-assistant") ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                            )}
                        >
                            <Link href="/ai-assistant">
                                <Bot className="mr-3 h-4 w-4" />
                                Assistant IA
                            </Link>
                        </Button>
                        <Button
                            variant={isActive("/analytics") ? "secondary" : "ghost"}
                            asChild
                            className={cn(
                                "w-full justify-start",
                                isActive("/analytics") ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                            )}
                        >
                            <Link href="/analytics">
                                <BarChart2 className="mr-3 h-4 w-4" />
                                Analytique
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>

            {/* User Footer Mis à jour */}
            <div className="p-4 border-t border-sidebar-border">
                <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-sidebar-accent cursor-default group transition-all">
                    <Avatar className="h-9 w-9 border border-sidebar-border">
                        <AvatarImage src="/avatar-placeholder.png" alt={user.username} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                            {user.initials}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-semibold leading-none truncate text-sidebar-foreground">
                            {user.username}
                        </p>
                        <p className="text-[11px] text-sidebar-foreground/60 truncate mt-1">
                            {user.email}
                        </p>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="p-1.5 rounded-md text-sidebar-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all"
                        title="Se déconnecter"
                    >
                        <LogOut className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </aside>
    )
}