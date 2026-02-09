"use client" // Obligatoire pour l'interactivité

import { useParams } from "next/navigation" // Pour récupérer l'ID
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
    Send,
    Zap,
    Phone,
    RotateCcw,
    CreditCard
} from "lucide-react"

export default function AiAssistantPage() {
    const params = useParams()
    const sessionId = params.id // On récupère le "4" de l'URL

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

            {/* Conversation Stream (Ton code actuel...) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                 {/* ... Garde tout le contenu de ton flux de messages ici ... */}
                 <div className="text-center text-[10px] text-muted-foreground opacity-50">
                    Début de la session de chat sécurisée
                 </div>

                 {/* Tes bulles de messages (Sophie, Thomas, etc.) */}
                 {/* ... */}
            </div>

            {/* Input Area (Ton code actuel...) */}
            <div className="p-6 pt-2 bg-background border-t shrink-0">
                {/* ... Garde ton bloc avec le Switch et l'Input ... */}
            </div>
        </div>
    )
}