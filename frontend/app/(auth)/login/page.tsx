"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function LoginPage() {
    return <LoginForm />
}

function LoginForm() {
    const router = useRouter()
    const [error, setError] = useState("")

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setError("")

        const formData = new FormData(event.currentTarget)
        const email = formData.get("email") as string
        const password = formData.get("password") as string

        if (email === "marimounalia@gmail.com" && password === "1234") {
            // Set simple cookie for demo purposes
            document.cookie = "auth_token=valid_token; path=/; max-age=86400; SameSite=Strict"
            // Use router.push via a wrapper or direct if client component
            // We need to ensure this is a client component
            window.location.href = "/" // Force full reload to ensure middleware picks up cookie immediately if needed, or router.push
        } else {
            setError("Identifiants incorrects. Veuillez réessayer.")
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-2xl">Connexion</CardTitle>
                <CardDescription>
                    Entrez vos identifiants pour accéder à votre compte.
                </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4">
                    {error && (
                        <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md">
                            {error}
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            name="email"
                            type="email"
                            placeholder="m@exemple.com"
                            required
                            defaultValue="marimounalia@gmail.com"
                        />
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="password">Mot de passe</Label>
                            <Link
                                href="/forgot-password"
                                className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                            >
                                Mot de passe oublié ?
                            </Link>
                        </div>
                        <Input
                            id="password"
                            name="password"
                            type="password"
                            required
                            defaultValue="1234"
                        />
                    </div>
                    <Button type="submit" className="w-full">
                        Se connecter
                    </Button>
                </CardContent>
            </form>
            <CardFooter className="flex justify-center">
                <div className="text-sm text-muted-foreground">
                    Pas encore de compte ?{" "}
                    <Link href="/sign-up" className="underline underline-offset-4 hover:text-primary">
                        S&apos;inscrire
                    </Link>
                </div>
            </CardFooter>
        </Card>
    )
}

