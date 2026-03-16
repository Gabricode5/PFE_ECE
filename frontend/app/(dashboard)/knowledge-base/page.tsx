"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
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
    Cpu,
    Upload,
    Loader2
} from "lucide-react"

export default function KnowledgeBasePage() {
    const [articles, setArticles] = useState(INITIAL_ARTICLES)
    const [searchQuery, setSearchQuery] = useState("")
    const [activeFilter, setActiveFilter] = useState("Tout")
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [activeTab, setActiveTab] = useState("write")
    const [newArticle, setNewArticle] = useState({
        title: "",
        category: "Guides",
        summary: "",
        tags: "",
        fileName: ""
    })
    const [sourceUrl, setSourceUrl] = useState("https://www.service-public.fr/particuliers/vosdroits/F1342")
    const [isIngesting, setIsIngesting] = useState(false)
    const [ingestMessage, setIngestMessage] = useState<string | null>(null)
    const [ingestError, setIngestError] = useState<string | null>(null)
    const [ingestJobId, setIngestJobId] = useState<string | null>(null)
    const ingestPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

    useEffect(() => {
        if (!ingestJobId) return

        if (ingestPollRef.current) {
            clearInterval(ingestPollRef.current)
        }

        ingestPollRef.current = setInterval(async () => {
            try {
                const response = await fetch(`/api/knowledge-base/ingest-status?job_id=${ingestJobId}`, {
                    credentials: "include",
                })
                if (!response.ok) return
                const data = await response.json()
                if (data.status === "completed") {
                    setIsIngesting(false)
                    setIngestJobId(null)
                    if (data.result?.inserted === 0) {
                        setIngestError("Aucun contenu récupéré. Le site bloque peut-être le scraping ou utilise du contenu dynamique.")
                    } else {
                        const inserted = data.result?.inserted ?? "?"
                        const url = data.result?.url ?? sourceUrl
                        setIngestMessage(`Indexation terminée : ${inserted} contenus indexés depuis ${url}`)
                    }
                }
                if (data.status === "failed") {
                    setIsIngesting(false)
                    setIngestJobId(null)
                    setIngestError(data.error || "Erreur pendant l'indexation.")
                }
            } catch {
                // On ignore pour éviter de spammer l'UI
            }
        }, 3000)

        return () => {
            if (ingestPollRef.current) {
                clearInterval(ingestPollRef.current)
                ingestPollRef.current = null
            }
        }
    }, [ingestJobId, sourceUrl])

    const handleIngestUrl = async () => {
        setIngestMessage(null)
        setIngestError(null)

        setIsIngesting(true)
        let isBackgroundJob = false
        try {
            const response = await fetch("/api/knowledge-base/ingest-url", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ url: sourceUrl }),
            })

            const data = await response.json()
            if (!response.ok) {
                if (response.status === 401) {
                    setIngestError("Session expirée. Veuillez vous reconnecter.")
                    return
                }
                setIngestError(data?.detail || "Impossible de lancer l'ingestion.")
                return
            }

            if (data.status === "started") {
                isBackgroundJob = true
                setIngestMessage(data.message || "Indexation lancée.")
                setIngestJobId(data.job_id || null)
                return
            }

            if (data.inserted === 0) {
                setIngestError("Aucun contenu récupéré. Le site bloque peut-être le scraping ou utilise du contenu dynamique.")
                return
            }
            setIngestMessage(`${data.inserted} contenus indexés depuis ${data.url}`)
        } catch (error) {
            console.error("Erreur ingestion URL:", error)
            setIngestError("Erreur réseau pendant l'ingestion.")
        } finally {
            if (!isBackgroundJob) {
                setIsIngesting(false)
            }
        }
    }

    const handleAddArticle = () => {
        let summaryText = newArticle.summary
        if (activeTab === "upload" && newArticle.fileName) {
            summaryText = `Document importé : ${newArticle.fileName}`
        }

        const article = {
            title: newArticle.title,
            summary: summaryText,
            icon: activeTab === "upload" ? <FileText className="h-5 w-5" /> : getIconForCategory(newArticle.category),
            tags: newArticle.tags.split(",").map(t => t.trim()).filter(Boolean),
            views: "0",
            rating: "0",
            date: "À l'instant",
            category: newArticle.category
        }
        setArticles([article, ...articles])
        setIsAddDialogOpen(false)
        setNewArticle({ title: "", category: "Guides", summary: "", tags: "", fileName: "" })
        setActiveTab("write")
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setNewArticle({ ...newArticle, fileName: e.target.files[0].name })
        }
    }

    const filteredArticles = articles.filter(article => {
        const matchesSearch = article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            article.summary.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesFilter = activeFilter === "Tout" || article.category === activeFilter
        return matchesSearch && matchesFilter
    })

    return (
        <div className="flex flex-col min-h-full">
            {/* Header & Search */}
            <div className="p-8 pb-4 space-y-6 bg-background border-b">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold tracking-tight">Base de connaissances</h1>
                    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                Ajouter un article
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader>
                                <DialogTitle>Ajouter un nouvel article</DialogTitle>
                                <DialogDescription>
                                    Ajoutez du contenu manuellement ou importez un document.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="title">Titre</Label>
                                    <Input
                                        id="title"
                                        value={newArticle.title}
                                        onChange={(e) => setNewArticle({ ...newArticle, title: e.target.value })}
                                        placeholder="Titre de l'article"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="category">Catégorie</Label>
                                    <Select
                                        value={newArticle.category}
                                        onValueChange={(value) => setNewArticle({ ...newArticle, category: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Sélectionner une catégorie" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="FAQ">FAQ</SelectItem>
                                            <SelectItem value="Guides">Guides</SelectItem>
                                            <SelectItem value="Documentation">Documentation</SelectItem>
                                            <SelectItem value="Vidéos">Vidéos</SelectItem>
                                            <SelectItem value="Formés IA">Formés IA</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="tags">Tags</Label>
                                    <Input
                                        id="tags"
                                        value={newArticle.tags}
                                        onChange={(e) => setNewArticle({ ...newArticle, tags: e.target.value })}
                                        placeholder="Ex: API, Tutoriel"
                                    />
                                </div>

                                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                    <TabsList className="grid w-full grid-cols-2">
                                        <TabsTrigger value="write">Rédiger</TabsTrigger>
                                        <TabsTrigger value="upload">Importer</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="write" className="space-y-2 mt-4">
                                        <Label htmlFor="summary">Contenu / Résumé</Label>
                                        <Textarea
                                            id="summary"
                                            value={newArticle.summary}
                                            onChange={(e) => setNewArticle({ ...newArticle, summary: e.target.value })}
                                            placeholder="Écrivez le contenu de votre article ici..."
                                            className="min-h-[150px]"
                                        />
                                    </TabsContent>
                                    <TabsContent value="upload" className="space-y-4 mt-4">
                                        <div className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-muted/30 transition-colors cursor-pointer"
                                            onClick={() => document.getElementById('file-upload')?.click()}
                                        >
                                            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                                                <Upload className="h-6 w-6 text-primary" />
                                            </div>
                                            <p className="text-sm font-medium">
                                                {newArticle.fileName ? newArticle.fileName : "Cliquez pour importer un fichier"}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                PDF, DOCX, ou TXT jusqu'à 10MB
                                            </p>
                                            <Input
                                                id="file-upload"
                                                type="file"
                                                className="hidden"
                                                onChange={handleFileChange}
                                                accept=".pdf,.doc,.docx,.txt"
                                            />
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </div>

                            <DialogFooter>
                                <Button onClick={handleAddArticle}>
                                    {activeTab === "upload" ? "Importer et Créer" : "Publier l'article"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="relative">
                    <Search className="absolute left-3.5 top-3.5 h-5 w-5 text-muted-foreground" />
                    <Input
                        placeholder="Rechercher dans la base de connaissances..."
                        className="pl-12 h-12 text-lg rounded-xl bg-muted/30 border-muted-foreground/20 focus-visible:bg-background"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="rounded-xl border bg-card p-4 space-y-3">
                    <Label htmlFor="source-url">Indexer une URL dans la base</Label>
                    <div className="flex flex-col md:flex-row gap-3">
                        <Input
                            id="source-url"
                            placeholder="https://..."
                            value={sourceUrl}
                            onChange={(e) => setSourceUrl(e.target.value)}
                        />
                        <Button onClick={handleIngestUrl} disabled={isIngesting || !sourceUrl.trim()}>
                            {isIngesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isIngesting ? "Indexation..." : "Indexer URL"}
                        </Button>
                    </div>
                    {ingestMessage && <p className="text-sm text-green-600">{ingestMessage}</p>}
                    {ingestError && <p className="text-sm text-red-600">{ingestError}</p>}
                </div>

                {/* Filter Bar */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                    <FilterChip label="Tout" active={activeFilter === "Tout"} onClick={() => setActiveFilter("Tout")} />
                    <FilterChip label="FAQ" icon={<HelpCircle className="h-3.5 w-3.5" />} active={activeFilter === "FAQ"} onClick={() => setActiveFilter("FAQ")} />
                    <FilterChip label="Guides" icon={<Book className="h-3.5 w-3.5" />} active={activeFilter === "Guides"} onClick={() => setActiveFilter("Guides")} />
                    <FilterChip label="Documentation" icon={<FileText className="h-3.5 w-3.5" />} active={activeFilter === "Documentation"} onClick={() => setActiveFilter("Documentation")} />
                    <FilterChip label="Vidéos" icon={<Video className="h-3.5 w-3.5" />} active={activeFilter === "Vidéos"} onClick={() => setActiveFilter("Vidéos")} />
                    <FilterChip label="Formés IA" icon={<Cpu className="h-3.5 w-3.5" />} active={activeFilter === "Formés IA"} onClick={() => setActiveFilter("Formés IA")} />
                </div>
            </div>

            <div className="p-8 space-y-8 max-w-7xl mx-auto w-full">

                {/* Metrics Summary Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard
                        icon={<FileText className="h-6 w-6 text-blue-500" />}
                        value={`${articles.length}`}
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
                    {filteredArticles.map((article, index) => (
                        <ArticleCard key={index} article={article} />
                    ))}
                </div>
            </div>
        </div>
    )
}

function FilterChip({ label, icon, active, onClick }: { label: string, icon?: React.ReactNode, active?: boolean, onClick?: () => void }) {
    return (
        <Button
            variant={active ? "default" : "outline"}
            size="sm"
            className={`rounded-full h-8 ${active ? "" : "bg-transparent hover:bg-muted"}`}
            onClick={onClick}
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

function getIconForCategory(category: string) {
    switch (category) {
        case "FAQ": return <HelpCircle className="h-5 w-5" />
        case "Guides": return <Book className="h-5 w-5" />
        case "Documentation": return <FileText className="h-5 w-5" />
        case "Vidéos": return <Video className="h-5 w-5" />
        case "Formés IA": return <Cpu className="h-5 w-5" />
        default: return <FileText className="h-5 w-5" />
    }
}

const INITIAL_ARTICLES = [
    {
        title: "Comment réinitialiser votre mot de passe ?",
        summary: "Guide étape par étape pour réinitialiser votre mot de passe en toute sécurité via le portail client ou l'application mobile.",
        icon: <Lightbulb className="h-5 w-5" />,
        tags: ["Compte", "Sécurité"],
        views: "2.4k",
        rating: "4.8",
        date: "Il y a 2 jours",
        category: "FAQ"
    },
    {
        title: "Comprendre votre facture mensuelle",
        summary: "Explication détaillée des différents frais et taxes qui peuvent apparaître sur votre facture de fin de mois.",
        icon: <FileText className="h-5 w-5" />,
        tags: ["Facturation", "Finance"],
        views: "1.8k",
        rating: "4.5",
        date: "Il y a 1 semaine",
        category: "Guides"
    },
    {
        title: "Intégration de l'API REST",
        summary: "Documentation technique pour les développeurs souhaitant intégrer notre solution via l'API REST.",
        icon: <Cpu className="h-5 w-5" />,
        tags: ["API", "Développeurs"],
        views: "956",
        rating: "4.9",
        date: "Il y a 3 semaines",
        category: "Documentation"
    },
    {
        title: "Tutoriel vidéo : Configuration initiale",
        summary: "Regardez cette vidéo de 5 minutes pour apprendre à configurer votre compte pour la première fois.",
        icon: <Video className="h-5 w-5" />,
        tags: ["Tutoriel", "Onboarding"],
        views: "5.1k",
        rating: "4.7",
        date: "Il y a 1 mois",
        category: "Vidéos"
    }
]
