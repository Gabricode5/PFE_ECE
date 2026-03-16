"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
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
    Search,
    Plus,
    FileText,
    Cpu,
    Upload,
    Loader2,
    Link,
    Globe,
    Trash2,
} from "lucide-react"

function getAuthToken(): string | null {
    const tokenPair = document.cookie
        .split("; ")
        .find((entry) => entry.startsWith("auth_token="))
    if (!tokenPair) return null
    return tokenPair.split("=")[1] || null
}

type KnowledgeItem = {
    id: number
    name: string | null
    source: string
    source_type: "url" | "pdf"
    category: string | null
    chunks: number
    pages: number | null
    date_creation: string
}

export default function KnowledgeBasePage() {
    const [items, setItems] = useState<KnowledgeItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [activeFilter, setActiveFilter] = useState("Tout")
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [newItem, setNewItem] = useState({ name: "", category: "pdf", fileName: "" })
    const [sourceUrl, setSourceUrl] = useState("https://www.service-public.fr/particuliers/vosdroits/F1342")
    const [isIngesting, setIsIngesting] = useState(false)
    const [ingestMessage, setIngestMessage] = useState<string | null>(null)
    const [ingestError, setIngestError] = useState<string | null>(null)
    const [isPdfUploading, setIsPdfUploading] = useState(false)
    const [pdfMessage, setPdfMessage] = useState<string | null>(null)
    const [pdfError, setPdfError] = useState<string | null>(null)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)

    const fetchItems = async () => {
        const token = getAuthToken()
        if (!token) { setIsLoading(false); return }
        try {
            const res = await fetch("/api/knowledge-base/items", {
                headers: { Authorization: `Bearer ${token}` },
            })
            if (res.ok) setItems(await res.json())
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => { fetchItems() }, [])

    const handleDeleteItem = async (id: number) => {
        const token = getAuthToken()
        if (!token) return
        await fetch(`/api/knowledge-base/items/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
        })
        setItems(prev => prev.filter(i => i.id !== id))
    }

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
                setIsIngesting(false)
                return
            }

            // Backend returns 202 immediately — ingestion runs in background.
            // Poll /knowledge-base/items every 5s until a new entry for this URL appears.
            setIngestMessage("Indexation en cours… cela peut prendre quelques minutes.")
            const targetUrl = data.url as string
            const previousCount = items.length
            const maxAttempts = 36 // 3 minutes max
            let attempts = 0

            const poll = async (): Promise<void> => {
                attempts++
                await fetchItems()
                const currentItems: KnowledgeItem[] = await (async () => {
                    const r = await fetch("/api/knowledge-base/items", {
                        headers: { Authorization: `Bearer ${token}` },
                    })
                    return r.ok ? r.json() : []
                })()

                const found = currentItems.find(i => i.source === targetUrl)
                if (found) {
                    setItems(currentItems)
                    setIngestMessage(`${found.chunks} segments indexés depuis "${targetUrl}"`)
                    setIsIngesting(false)
                    return
                }
                if (attempts < maxAttempts) {
                    setTimeout(poll, 5000)
                } else {
                    setIngestMessage("Indexation lancée. Rafraîchissez dans quelques instants.")
                    setIsIngesting(false)
                }
            }

            setTimeout(poll, 5000)
        } catch (error) {
            console.error("Erreur ingestion URL:", error)
            setIngestError("Erreur réseau pendant l'ingestion.")
            setIsIngesting(false)
        }
    }

    const handleAddArticle = async () => {
        if (selectedFile) {
            setPdfError(null)
            setPdfMessage(null)
            const token = getAuthToken()
            if (!token) { setPdfError("Session expirée."); return }

            setIsPdfUploading(true)
            try {
                const formData = new FormData()
                formData.append("file", selectedFile)
                formData.append("category", newItem.category)
                formData.append("name", newItem.name)

                const response = await fetch("/api/knowledge-base/ingest-pdf", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                    body: formData,
                })
                const data = await response.json()
                if (!response.ok) { setPdfError(data?.detail || "Erreur upload."); return }

                setPdfMessage(`${data.inserted} segments indexés depuis "${data.filename}" (${data.pages} pages)`)
                await fetchItems()
                setIsAddDialogOpen(false)
                setSelectedFile(null)
                setNewItem({ name: "", category: "pdf", fileName: "" })
            } catch {
                setPdfError("Erreur réseau pendant l'upload.")
            } finally {
                setIsPdfUploading(false)
            }
            return
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0])
            setNewItem(prev => ({ ...prev, fileName: e.target.files![0].name }))
        }
    }

    const filteredItems = items.filter(item => {
        const q = searchQuery.toLowerCase()
        const matchesSearch = item.source.toLowerCase().includes(q) ||
            (item.name ?? "").toLowerCase().includes(q) ||
            (item.category ?? "").toLowerCase().includes(q)
        const matchesFilter = activeFilter === "Tout" || item.source_type === activeFilter.toLowerCase() || item.category === activeFilter
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
                        <DialogContent className="sm:max-w-[440px]">
                            <DialogHeader>
                                <DialogTitle>Indexer un document PDF</DialogTitle>
                                <DialogDescription>
                                    Le document sera découpé, vectorisé et stocké dans la base de connaissances.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="grid gap-4 py-4">
                                {/* name */}
                                <div className="grid gap-2">
                                    <Label htmlFor="item-name">Nom <span className="text-muted-foreground font-normal">(optionnel)</span></Label>
                                    <Input
                                        id="item-name"
                                        value={newItem.name}
                                        onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="Ex : Guide d'installation v2"
                                    />
                                </div>

                                {/* category */}
                                <div className="grid gap-2">
                                    <Label htmlFor="item-category">Catégorie</Label>
                                    <Select
                                        value={newItem.category}
                                        onValueChange={(v) => setNewItem(prev => ({ ...prev, category: v }))}
                                    >
                                        <SelectTrigger id="item-category">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="pdf">PDF</SelectItem>
                                            <SelectItem value="documentation">Documentation</SelectItem>
                                            <SelectItem value="guide">Guide</SelectItem>
                                            <SelectItem value="faq">FAQ</SelectItem>
                                            <SelectItem value="autre">Autre</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* file */}
                                <div className="grid gap-2">
                                    <Label>Fichier PDF</Label>
                                    <div
                                        className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-6 flex flex-col items-center justify-center text-center hover:bg-muted/30 transition-colors cursor-pointer"
                                        onClick={() => document.getElementById("file-upload")?.click()}
                                    >
                                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                                            <Upload className="h-5 w-5 text-primary" />
                                        </div>
                                        <p className="text-sm font-medium">
                                            {newItem.fileName || "Cliquez pour choisir un fichier"}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">PDF uniquement · 10 Mo max</p>
                                        <Input
                                            id="file-upload"
                                            type="file"
                                            className="hidden"
                                            onChange={handleFileChange}
                                            accept=".pdf"
                                        />
                                    </div>
                                </div>
                            </div>

                            <DialogFooter className="flex-col items-start gap-2 sm:flex-row sm:items-center">
                                {pdfMessage && <p className="text-sm text-green-600 flex-1">{pdfMessage}</p>}
                                {pdfError && <p className="text-sm text-red-600 flex-1">{pdfError}</p>}
                                <Button
                                    onClick={handleAddArticle}
                                    disabled={isPdfUploading || !selectedFile}
                                >
                                    {isPdfUploading
                                        ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Indexation...</>
                                        : "Importer et Indexer"
                                    }
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
                    <FilterChip label="PDF" icon={<FileText className="h-3.5 w-3.5" />} active={activeFilter === "PDF"} onClick={() => setActiveFilter("PDF")} />
                    <FilterChip label="URL" icon={<Globe className="h-3.5 w-3.5" />} active={activeFilter === "URL"} onClick={() => setActiveFilter("URL")} />
                </div>
            </div>

            <div className="p-8 space-y-8 max-w-7xl mx-auto w-full">

                {/* Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <MetricCard
                        icon={<FileText className="h-6 w-6 text-blue-500" />}
                        value={`${items.length}`}
                        label="Sources indexées"
                    />
                    <MetricCard
                        icon={<Cpu className="h-6 w-6 text-purple-500" />}
                        value={`${items.reduce((s, i) => s + i.chunks, 0)}`}
                        label="Segments totaux"
                    />
                    <MetricCard
                        icon={<Globe className="h-6 w-6 text-green-500" />}
                        value={`${items.filter(i => i.source_type === "url").length}`}
                        label="URLs indexées"
                    />
                </div>

                {/* Items Grid */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-16 text-muted-foreground">
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Chargement...
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                        <FileText className="h-10 w-10 opacity-30" />
                        <p className="text-sm">Aucune source indexée pour l&apos;instant.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {filteredItems.map((item) => (
                            <SourceCard key={item.id} item={item} onDelete={handleDeleteItem} />
                        ))}
                    </div>
                )}
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

function SourceCard({ item, onDelete }: { item: KnowledgeItem; onDelete: (id: number) => Promise<void> }) {
    const isPdf = item.source_type === "pdf"
    const displayName = item.name || item.source
    const date = new Date(item.date_creation).toLocaleDateString("fr-FR", {
        day: "numeric", month: "short", year: "numeric"
    })
    const [isDeleting, setIsDeleting] = useState(false)

    const handleDelete = async () => {
        if (!confirm(`Supprimer "${displayName}" et ses ${item.chunks} segments ?`)) return
        setIsDeleting(true)
        await onDelete(item.id)
        setIsDeleting(false)
    }

    return (
        <Card className="hover:shadow-md transition-shadow group">
            <CardHeader className="pb-3">
                <div className="flex gap-3 items-start">
                    <div className="h-10 w-10 rounded-lg bg-primary/5 text-primary flex items-center justify-center shrink-0 mt-0.5">
                        {isPdf ? <FileText className="h-5 w-5" /> : <Globe className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                                <CardTitle className="text-base leading-snug line-clamp-2">
                                    {displayName}
                                </CardTitle>
                                {item.name && (
                                    <p className="text-xs text-muted-foreground mt-0.5 truncate" title={item.source}>
                                        {item.source}
                                    </p>
                                )}
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
                                onClick={handleDelete}
                                disabled={isDeleting}
                            >
                                {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            </Button>
                        </div>
                        <div className="flex gap-2 mt-2 flex-wrap items-center">
                            <Badge className="bg-green-100 text-green-700 border-green-200 font-normal text-xs">
                                Indexé
                            </Badge>
                            <Badge variant="secondary" className="font-normal text-xs bg-muted/50 text-muted-foreground uppercase">
                                {item.source_type}
                            </Badge>
                            {item.category && (
                                <Badge variant="secondary" className="font-normal text-xs bg-muted/50 text-muted-foreground">
                                    {item.category}
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardFooter className="pt-3 border-t bg-muted/5 flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                        <Cpu className="h-3.5 w-3.5" />
                        {item.chunks} segments
                    </div>
                    {item.pages != null && (
                        <div className="flex items-center gap-1">
                            <FileText className="h-3.5 w-3.5" />
                            {item.pages} pages
                        </div>
                    )}
                    {!isPdf && (
                        <div className="flex items-center gap-1">
                            <Link className="h-3.5 w-3.5" />
                            URL
                        </div>
                    )}
                </div>
                <span>{date}</span>
            </CardFooter>
        </Card>
    )
}
