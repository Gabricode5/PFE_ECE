"use client"

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

    const isActive = (path: string) => {
        if (path === "/") {
            return pathname === "/"
        }
        return pathname?.startsWith(path)
    }

    const handleLogout = () => {
        document.cookie = "auth_token=; path=/; max-age=0; SameSite=Strict"
        window.location.href = "/login"
    }


    return (
        <aside className="w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border hidden md:flex flex-col">
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
                {/* Primary Menu */}
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

            {/* User Footer */}
            <div className="p-4 border-t border-sidebar-border">
                <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-sidebar-accent cursor-pointer group">
                    <Avatar className="h-9 w-9">
                        <AvatarImage src="/avatar-placeholder.png" alt="User" />
                        <AvatarFallback>JD</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-medium leading-none truncate group-hover:text-sidebar-accent-foreground">Jean Dupont</p>
                        <p className="text-xs text-sidebar-foreground/70 truncate group-hover:text-sidebar-accent-foreground/70">jean@exemple.com</p>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="text-sidebar-foreground/50 hover:text-destructive transition-colors"
                        title="Se déconnecter"
                    >
                        <LogOut className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </aside>
    )
}
