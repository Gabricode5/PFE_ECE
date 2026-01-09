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
                        <h2 className="font-semibold text-sm">Jean Dupont</h2>
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
            <div className="flex-1 overflow-y-auto p-6 space-y-8">

                {/* AI Message 1: Greeting & Quick Actions */}
                <div className="flex gap-4 max-w-3xl">
                    <Avatar className="h-10 w-10 border mt-1">
                        <AvatarImage src="/bot-avatar.png" alt="AI" />
                        <AvatarFallback className="bg-primary text-primary-foreground">AI</AvatarFallback>
                    </Avatar>
                    <div className="space-y-2">
                        <div className="bg-background border rounded-2xl rounded-tl-none p-4 shadow-sm">
                            <p className="text-sm">Bonjour Jean, que puis-je faire pour vous aujourd&apos;hui ?</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" className="justify-start h-auto py-2 px-3 text-xs bg-background/50 border-dashed hover:bg-background hover:border-solid transition-all">
                                <CreditCard className="mr-2 h-3 w-3 text-primary" />
                                Facturation
                            </Button>
                            <Button variant="outline" className="justify-start h-auto py-2 px-3 text-xs bg-background/50 border-dashed hover:bg-background hover:border-solid transition-all">
                                <Zap className="mr-2 h-3 w-3 text-orange-500" />
                                Suivi
                            </Button>
                            <Button variant="outline" className="justify-start h-auto py-2 px-3 text-xs bg-background/50 border-dashed hover:bg-background hover:border-solid transition-all">
                                <Phone className="mr-2 h-3 w-3 text-green-500" />
                                Support Technique
                            </Button>
                        </div>
                        <p className="text-[10px] text-muted-foreground pl-1">09:41 • Confiance IA: 99%</p>
                    </div>
                </div>

                {/* User Message */}
                <div className="flex gap-4 max-w-3xl ml-auto flex-row-reverse">
                    <Avatar className="h-10 w-10 border mt-1">
                        <AvatarImage src="/user-avatar.png" alt="User" />
                        <AvatarFallback>JD</AvatarFallback>
                    </Avatar>
                    <div className="space-y-2 flex flex-col items-end">
                        <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-none p-4 shadow-sm">
                            <p className="text-sm">J&apos;ai un problème avec ma commande #12345. Je voudrais être remboursé.</p>
                        </div>
                        <p className="text-[10px] text-muted-foreground pr-1">09:42</p>
                    </div>
                </div>

                {/* AI Message 2: Detailed Response & Chips */}
                <div className="flex gap-4 max-w-3xl">
                    <Avatar className="h-10 w-10 border mt-1">
                        <AvatarImage src="/bot-avatar.png" alt="AI" />
                        <AvatarFallback className="bg-primary text-primary-foreground">AI</AvatarFallback>
                    </Avatar>
                    <div className="space-y-3">
                        <div className="bg-background border rounded-2xl rounded-tl-none p-4 shadow-sm space-y-3">
                            <p className="text-sm">Je vois que votre commande <span className="font-mono bg-muted px-1 py-0.5 rounded text-xs">#12345</span> a été livrée hier. Je suis désolé que vous ne soyez pas satisfait.</p>
                            <p className="text-sm">Je peux procéder à un échange immédiat ou initier une demande de remboursement sur votre mode de paiement original.</p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white h-8 rounded-full text-xs px-4">
                                <RotateCcw className="mr-1.5 h-3 w-3" />
                                Échange Immédiat
                            </Button>
                            <Button size="sm" variant="secondary" className="h-8 rounded-full text-xs px-4">
                                <CreditCard className="mr-1.5 h-3 w-3" />
                                Remboursement
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 rounded-full text-xs px-4 hover:bg-muted">
                                <Phone className="mr-1.5 h-3 w-3" />
                                Parler à un agent
                            </Button>
                        </div>

                        <p className="text-[10px] text-muted-foreground pl-1">09:42 • Confiance IA: 95%</p>
                    </div>
                </div>

                {/* Typing Indicator */}
                <div className="flex gap-4 max-w-3xl">
                    <Avatar className="h-8 w-8 border mt-1 opacity-70">
                        <AvatarImage src="/bot-avatar.png" alt="AI" />
                        <AvatarFallback className="bg-primary/50 text-white">AI</AvatarFallback>
                    </Avatar>
                    <div className="bg-background/50 border rounded-2xl rounded-tl-none px-4 py-3 shadow-sm w-16 flex items-center justify-center">
                        <div className="flex space-x-1">
                            <div className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                            <div className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                            <div className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce"></div>
                        </div>
                    </div>
                </div>

            </div>

            {/* Input Area */}
            <div className="p-6 pt-2 bg-background border-t shrink-0">

                {/* AI Control Bar */}
                <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-primary fill-primary/20" />
                        <span className="text-xs font-semibold text-primary">Mode IA Actif</span>
                    </div>
                    <Switch defaultChecked />
                </div>

                {/* Message Field */}
                <div className="relative flex items-center">
                    <div className="absolute left-3 flex items-center gap-2 text-muted-foreground">
                        <Smile className="h-5 w-5 hover:text-foreground cursor-pointer transition-colors" />
                        <Paperclip className="h-5 w-5 hover:text-foreground cursor-pointer transition-colors" />
                        <ImageIcon className="h-5 w-5 hover:text-foreground cursor-pointer transition-colors" />
                    </div>
                    <Input
                        placeholder="Écrivez votre message..."
                        className="pl-32 pr-12 h-14 rounded-2xl border-muted-foreground/20 text-base shadow-sm focus-visible:ring-offset-0 focus-visible:ring-1 focus-visible:ring-primary/50"
                    />
                    <Button size="icon" className="absolute right-2 h-10 w-10 rounded-xl">
                        <Send className="h-4 w-4" />
                    </Button>
                </div>
                <div className="text-center mt-2">
                    <span className="text-[10px] text-muted-foreground">Entrée pour envoyer • Maj + Entrée pour nouvelle ligne</span>
                </div>
            </div>
        </div>
    )
}
