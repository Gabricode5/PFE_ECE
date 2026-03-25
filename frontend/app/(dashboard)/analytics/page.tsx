"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import {
    TrendingUp,
    TrendingDown,
    MessageSquare,
    Zap,
    Clock,
    Star,
} from "lucide-react"

// Data for grouped bar chart
const conversationData = [
    { name: 'Lun', IA: 400, Humain: 240 },
    { name: 'Mar', IA: 300, Humain: 139 },
    { name: 'Mer', IA: 200, Humain: 980 },
    { name: 'Jeu', IA: 278, Humain: 390 },
    { name: 'Ven', IA: 189, Humain: 480 },
    { name: 'Sam', IA: 239, Humain: 380 },
    { name: 'Dim', IA: 349, Humain: 430 },
];

// Data for donut chart
const transferData = [
    { name: 'Technique', value: 400, color: '#0ea5e9' }, // Sky 500
    { name: 'Complexe', value: 300, color: '#f59e0b' }, // Amber 500
    { name: 'Sensible', value: 300, color: '#ef4444' }, // Red 500
    { name: 'Autre', value: 200, color: '#8b5cf6' }, // Violet 500
];

const totalTransfers = transferData.reduce((acc, curr) => acc + curr.value, 0);

const agents = [
    { name: "Sarah Connor", conversations: 145, satisfaction: 4.9, time: "3.2 min", performance: 92 },
    { name: "John Doe", conversations: 123, satisfaction: 4.7, time: "4.1 min", performance: 85 },
    { name: "Alice Smith", conversations: 98, satisfaction: 4.8, time: "3.5 min", performance: 88 },
    { name: "Bob Wilson", conversations: 87, satisfaction: 4.6, time: "4.5 min", performance: 78 },
    { name: "Emma Watson", conversations: 65, satisfaction: 5.0, time: "2.9 min", performance: 98 },
];

export default function AnalyticsPage() {
    return (
        <div className="flex flex-col min-h-full">
            {/* Header & Controls */}
            <div className="p-8 pb-4 bg-background border-b flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Analytique IA</h1>
                    <p className="text-muted-foreground">Performance de l&apos;assistant virtuel et métriques clés</p>
                </div>

                <div className="flex bg-muted/50 p-1 rounded-lg">
                    <Button variant="ghost" size="sm" className="rounded-md hover:bg-background text-muted-foreground hover:text-foreground">7 Jours</Button>
                    <Button variant="secondary" size="sm" className="rounded-md shadow-sm bg-background text-foreground">30 Jours</Button>
                    <Button variant="ghost" size="sm" className="rounded-md hover:bg-background text-muted-foreground hover:text-foreground">90 Jours</Button>
                    <Button variant="ghost" size="sm" className="rounded-md hover:bg-background text-muted-foreground hover:text-foreground">Année</Button>
                </div>
            </div>

            <div className="p-8 space-y-8 max-w-7xl mx-auto w-full">

                {/* KPI Metrics Grid */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    <KpiCard
                        title="Conversations Totales"
                        value="12,450"
                        trend="+24% ce mois"
                        trendUp={true}
                        icon={<MessageSquare className="h-4 w-4 text-muted-foreground" />}
                    />
                    <KpiCard
                        title="Taux de résolution IA"
                        value="89.2%"
                        trend="+1.5% ce mois"
                        trendUp={true}
                        icon={<Zap className="h-4 w-4 text-yellow-500" />}
                    />
                    <KpiCard
                        title="Temps de réponse moyen"
                        value="1.2s"
                        trend="-0.3s ce mois"
                        trendUp={true} // Interpreted as good (faster)
                        icon={<Clock className="h-4 w-4 text-blue-500" />}
                    />
                    <KpiCard
                        title="Score de Satisfaction"
                        value="4.85"
                        trend="+0.1 ce mois"
                        trendUp={true}
                        icon={<Star className="h-4 w-4 text-purple-500" />}
                    />
                </div>

                {/* Data Visualization Grid */}
                <div className="grid gap-6 lg:grid-cols-3">

                    {/* Bar Chart: Conversation Evolution */}
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle>Évolution des Conversations</CardTitle>
                            <CardDescription>Comparaison du volume traité par IA vs Humain sur les 7 derniers jours.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={conversationData}
                                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                        <XAxis
                                            dataKey="name"
                                            stroke="#64748B"
                                            fontSize={12}
                                            tickLine={false}
                                            axisLine={false}
                                        />
                                        <YAxis
                                            stroke="#64748B"
                                            fontSize={12}
                                            tickLine={false}
                                            axisLine={false}
                                            tickFormatter={(value) => `${value}`}
                                        />
                                        <Tooltip
                                            cursor={{ fill: '#F1F5F9' }}
                                            contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        />
                                        <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                                        <Bar dataKey="IA" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={30} />
                                        <Bar dataKey="Humain" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={30} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Donut Chart: Transfer Reasons */}
                    <Card className="lg:col-span-1">
                        <CardHeader>
                            <CardTitle>Raisons du Transfert</CardTitle>
                            <CardDescription>Pourquoi l&apos;IA passe le relais.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[200px] w-full relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={transferData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {transferData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <span className="text-3xl font-bold">{totalTransfers}</span>
                                    <span className="text-xs text-muted-foreground">Total</span>
                                </div>
                            </div>
                            <div className="mt-4 space-y-2">
                                {transferData.map((item, index) => (
                                    <div key={index} className="flex justify-between items-center text-sm">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                                            <span className="text-muted-foreground">{item.name}</span>
                                        </div>
                                        <span className="font-semibold">{Math.round((item.value / totalTransfers) * 100)}%</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Agent Performance Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Performance des Agents (Support Humain)</CardTitle>
                        <CardDescription>Métriques détaillées pour les agents prenant le relais de l&apos;IA.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {/* Header Row */}
                            <div className="grid grid-cols-12 gap-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-2 border-b">
                                <div className="col-span-4 pl-2">Agent</div>
                                <div className="col-span-2 text-center">Conversations</div>
                                <div className="col-span-2 text-center">Satisfaction</div>
                                <div className="col-span-2 text-center">Temps Moy.</div>
                                <div className="col-span-2 text-right pr-2">Performance</div>
                            </div>

                            {/* Rows */}
                            {agents.map((agent, index) => (
                                <div key={index} className="grid grid-cols-12 gap-4 items-center py-2 hover:bg-muted/50 rounded-lg transition-colors">
                                    <div className="col-span-4 flex items-center gap-3 pl-2">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={`/avatars/agent-${index}.png`} />
                                            <AvatarFallback>{agent.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                                        </Avatar>
                                        <span className="font-medium text-sm">{agent.name}</span>
                                    </div>
                                    <div className="col-span-2 text-center text-sm">{agent.conversations}</div>
                                    <div className="col-span-2 flex items-center justify-center gap-1 text-sm">
                                        <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                                        {agent.satisfaction}
                                    </div>
                                    <div className="col-span-2 text-center text-sm text-muted-foreground">{agent.time}</div>
                                    <div className="col-span-2 pr-2">
                                        <div className="flex items-center gap-2 justify-end">
                                            <span className="text-xs font-medium w-8 text-right">{agent.performance}%</span>
                                            <div className="h-2 w-16 bg-muted rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${agent.performance > 90 ? 'bg-green-500' : agent.performance > 80 ? 'bg-blue-500' : 'bg-yellow-500'}`}
                                                    style={{ width: `${agent.performance}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

            </div>
        </div>
    )
}

function KpiCard({ title, value, trend, trendUp, icon }: { title: string, value: string, trend: string, trendUp: boolean, icon: React.ReactNode }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                <p className="text-xs text-muted-foreground flex items-center mt-1">
                    {trendUp ? (
                        <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                    ) : (
                        <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
                    )}
                    <span className={trendUp ? "text-green-500 font-medium" : "text-red-500 font-medium"}>
                        {trend.split(' ')[0]}
                    </span>
                    <span className="ml-1">{trend.split(' ').slice(1).join(' ')}</span>
                </p>
            </CardContent>
        </Card>
    )
}
