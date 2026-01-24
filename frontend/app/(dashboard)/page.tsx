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
    Bot
} from "lucide-react"
import { LogoutButton } from "@/components/logoutButton"

export default function DashboardPage() {
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
    {/* Barre de recherche existante */}
                    <div className="relative w-96 hidden md:block">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Rechercher des conversations ou des clients..."
                            className="pl-9 bg-muted/20 border-muted-foreground/20 focus-visible:ring-offset-0 focus-visible:bg-background transition-colors"
                        />
                    </div>

                    {/* Bouton Notification existant */}
                    <Button variant="ghost" size="icon" className="relative">
                        <Bell className="h-5 w-5" />
                        <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive border-2 border-background" />
                    </Button>

                    {/* --- AJOUT DU BOUTON DÉCONNEXION ICI --- */}
                    <div className="h-6 w-[1px] bg-border mx-1" /> {/* Séparateur visuel */}
                    <LogoutButton />
                </div>
            </header>

            <div className="p-8 space-y-8 max-w-7xl mx-auto w-full">

                {/* KPI Metrics Grid */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    {/* Card 1: Total Conversations */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Total Conversations</CardTitle>
                            <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">1,284</div>
                            <p className="text-xs text-muted-foreground flex items-center mt-1">
                                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                                <span className="text-green-500 font-medium">+12%</span>
                                <span className="ml-1">depuis le mois dernier</span>
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
                            <div className="text-2xl font-bold">84%</div>
                            <p className="text-xs text-muted-foreground flex items-center mt-1">
                                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                                <span className="text-green-500 font-medium">+5%</span>
                                <span className="ml-1">tendance positive</span>
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
                            <div className="text-2xl font-bold">45s</div>
                            <p className="text-xs text-muted-foreground flex items-center mt-1">
                                <TrendingDown className="h-3 w-3 text-green-500 mr-1" />
                                <span className="text-green-500 font-medium">-12s</span>
                                <span className="ml-1">plus rapide</span>
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
                            <div className="text-2xl font-bold">4.8/5</div>
                            <p className="text-xs text-muted-foreground flex items-center mt-1">
                                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                                <span className="text-green-500 font-medium">+0.2</span>
                                <span className="ml-1">consistant</span>
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Content Section: Activity Feed & AI Panel */}
                <div className="grid gap-6 lg:grid-cols-7">

                    {/* Recent Activity Feed */}
                    <Card className="col-span-4 lg:col-span-5">
                        <CardHeader>
                            <CardTitle>Conversations Récentes</CardTitle>
                            <CardDescription>
                                Vous avez 12 nouvelles conversations aujourd&apos;hui.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-6">
                                {recentActivity.map((item, index) => (
                                    <div key={index} className="flex items-center justify-between group">
                                        <div className="flex items-center gap-4">
                                            <Avatar className="h-10 w-10 border">
                                                <AvatarImage src={`/avatars/${index}.png`} alt={item.name} />
                                                <AvatarFallback>{item.initials}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="text-sm font-medium leading-none">{item.name}</p>
                                                <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                                                    {item.message}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="text-xs text-muted-foreground whitespace-nowrap">{item.time}</span>
                                            <Badge
                                                variant={item.type === "AI" ? "secondary" : "outline"}
                                                className={item.type === "AI" ? "bg-primary/10 text-primary hover:bg-primary/15 border-0" : ""}
                                            >
                                                {item.type === "AI" ? <Bot className="h-3 w-3 mr-1" /> : null}
                                                {item.type === "AI" ? "IA Autonome" : "Agent Humain"}
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
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
                            <Button className="w-full" size="lg">
                                Démarrer une conversation de test
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}

const recentActivity = [
    {
        name: "Sophie Martin",
        initials: "SM",
        message: "Je voudrais savoir si mon colis est arrivé...",
        time: "il y a 2 min",
        type: "AI",
    },
    {
        name: "Thomas Bernard",
        initials: "TB",
        message: "Impossible de me connecter à mon compte...",
        time: "il y a 15 min",
        type: "Human",
    },
    {
        name: "Julie Petit",
        initials: "JP",
        message: "Quels sont vos tarifs pour les professionnels ?",
        time: "il y a 32 min",
        type: "AI",
    },
    {
        name: "Lucas Dubois",
        initials: "LD",
        message: "J'ai besoin d'une facture pour ma dernière commande.",
        time: "il y a 1h",
        type: "AI",
    },
    {
        name: "Emma Leroy",
        initials: "EL",
        message: "Comment annuler mon abonnement ?",
        time: "il y a 2h",
        type: "Human",
    },
]
