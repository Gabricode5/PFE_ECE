import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Search,
    Plus,
    FileText,
    Eye,
    Star,
    Edit2,
    Trash2,
    Book,
    Video,
    HelpCircle,
    Lightbulb,
    Cpu
} from "lucide-react"

export default function KnowledgeBasePage() {
    return (
        <div className="flex flex-col min-h-full">
            {/* Header & Search */}
            <div className="p-8 pb-4 space-y-6 bg-background border-b">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold tracking-tight">Base de connaissances</h1>
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Ajouter un article
                    </Button>
                </div>

                <div className="relative">
                    <Search className="absolute left-3.5 top-3.5 h-5 w-5 text-muted-foreground" />
                    <Input
                        placeholder="Rechercher dans la base de connaissances..."
                        className="pl-12 h-12 text-lg rounded-xl bg-muted/30 border-muted-foreground/20 focus-visible:bg-background"
                    />
                </div>

                {/* Filter Bar */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                    <FilterChip label="Tout" active />
                    <FilterChip label="FAQ" icon={<HelpCircle className="h-3.5 w-3.5" />} />
                    <FilterChip label="Guides" icon={<Book className="h-3.5 w-3.5" />} />
                    <FilterChip label="Documentation" icon={<FileText className="h-3.5 w-3.5" />} />
                    <FilterChip label="Vidéos" icon={<Video className="h-3.5 w-3.5" />} />
                    <FilterChip label="Formés IA" icon={<Cpu className="h-3.5 w-3.5" />} />
                    <FilterChip label="Populaire" icon={<Star className="h-3.5 w-3.5" />} />
                </div>
            </div>

            <div className="p-8 space-y-8 max-w-7xl mx-auto w-full">

                {/* Metrics Summary Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard
                        icon={<FileText className="h-6 w-6 text-blue-500" />}
                        value="142"
                        label="Articles Totaux"
                    />
                    <MetricCard
                        icon={<Cpu className="h-6 w-6 text-purple-500" />}
                        value="128"
                        label="Indexés IA"
                    />
                    <MetricCard
                        icon={<Eye className="h-6 w-6 text-green-500" />}
                        value="45.2k"
                        label="Vues ce mois"
                    />
                    <MetricCard
                        icon={<Star className="h-6 w-6 text-yellow-500" />}
                        value="4.7/5"
                        label="Note moyenne"
                    />
                </div>

                {/* Article Content Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {articles.map((article, index) => (
                        <ArticleCard key={index} article={article} />
                    ))}
                </div>
            </div>
        </div>
    )
}

function FilterChip({ label, icon, active }: { label: string, icon?: React.ReactNode, active?: boolean }) {
    return (
        <Button
            variant={active ? "default" : "outline"}
            size="sm"
            className={`rounded-full h-8 ${active ? "" : "bg-transparent hover:bg-muted"}`}
        >
            {icon && <span className="mr-2 opacity-70">{icon}</span>}
            {label}
        </Button>
    )
}

function MetricCard({ icon, value, label }: { icon: React.ReactNode, value: string, label: string }) {
    return (
        <Card>
            <CardContent className="flex items-center gap-4 p-6">
                <div className="h-12 w-12 rounded-xl bg-background border flex items-center justify-center shadow-sm">
                    {icon}
                </div>
                <div>
                    <div className="text-2xl font-bold">{value}</div>
                    <div className="text-sm text-muted-foreground">{label}</div>
                </div>
            </CardContent>
        </Card>
    )
}

function ArticleCard({ article }: { article: any }) {
    return (
        <Card className="hover:shadow-md transition-shadow cursor-pointer group">
            <CardHeader className="space-y-3 pb-3">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/5 text-primary flex items-center justify-center shrink-0">
                            {article.icon}
                        </div>
                        <div>
                            <CardTitle className="text-lg leading-tight group-hover:text-primary transition-colors">
                                {article.title}
                            </CardTitle>
                            <div className="flex gap-2 mt-2">
                                {article.tags.map((tag: string) => (
                                    <Badge key={tag} variant="secondary" className="font-normal text-xs bg-muted/50 text-muted-foreground">
                                        {tag}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pb-3">
                <p className="text-sm text-muted-foreground line-clamp-2">
                    {article.summary}
                </p>
            </CardContent>
            <CardFooter className="pt-3 border-t bg-muted/5 flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                        <Eye className="h-3.5 w-3.5" />
                        {article.views}
                    </div>
                    <div className="flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500/20" />
                        {article.rating}
                    </div>
                    <span>{article.date}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                        <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </CardFooter>
        </Card>
    )
}

const articles = [
    {
        title: "Comment réinitialiser votre mot de passe ?",
        summary: "Guide étape par étape pour réinitialiser votre mot de passe en toute sécurité via le portail client ou l'application mobile.",
        icon: <Lightbulb className="h-5 w-5" />,
        tags: ["Compte", "Sécurité"],
        views: "2.4k",
        rating: "4.8",
        date: "Il y a 2 jours"
    },
    {
        title: "Comprendre votre facture mensuelle",
        summary: "Explication détaillée des différents frais et taxes qui peuvent apparaître sur votre facture de fin de mois.",
        icon: <FileText className="h-5 w-5" />,
        tags: ["Facturation", "Finance"],
        views: "1.8k",
        rating: "4.5",
        date: "Il y a 1 semaine"
    },
    {
        title: "Intégration de l'API REST",
        summary: "Documentation technique pour les développeurs souhaitant intégrer notre solution via l'API REST.",
        icon: <Cpu className="h-5 w-5" />,
        tags: ["API", "Développeurs"],
        views: "956",
        rating: "4.9",
        date: "Il y a 3 semaines"
    },
    {
        title: "Tutoriel vidéo : Configuration initiale",
        summary: "Regardez cette vidéo de 5 minutes pour apprendre à configurer votre compte pour la première fois.",
        icon: <Video className="h-5 w-5" />,
        tags: ["Tutoriel", "Onboarding"],
        views: "5.1k",
        rating: "4.7",
        date: "Il y a 1 mois"
    }
]
