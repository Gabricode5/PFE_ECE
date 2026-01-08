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

export default function SignUpPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-2xl">Créer un compte</CardTitle>
                <CardDescription>
                    Entrez vos informations pour créer votre compte.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Nom</Label>
                    <Input id="name" placeholder="Jean Dupont" required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="m@exemple.com" required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="password">Mot de passe</Label>
                    <Input id="password" type="password" required />
                </div>
                <Button type="submit" className="w-full">
                    S&apos;inscrire
                </Button>
            </CardContent>
            <CardFooter className="flex justify-center">
                <div className="text-sm text-muted-foreground">
                    Déjà un compte ?{" "}
                    <Link href="/login" className="underline underline-offset-4 hover:text-primary">
                        Se connecter
                    </Link>
                </div>
            </CardFooter>
        </Card>
    )
}
