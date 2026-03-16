"use client"

import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"

export function LogoutButton() {
    const router = useRouter()

    const handleLogout = async () => {
        try {
            await fetch("/api/logout", { method: "POST" });
        } catch {
            // On continue quand même la déconnexion locale.
        }

        // Nettoyage local
        localStorage.removeItem("username");
        localStorage.removeItem("user_email");
        localStorage.removeItem("user_role");
        localStorage.removeItem("user_id");

        // Redirection
        router.push("/login");
        router.refresh();
    };

    return (
        <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleLogout}
            className="text-muted-foreground hover:text-destructive transition-colors"
            title="Se déconnecter"
        >
            <LogOut className="h-5 w-5" />
        </Button>
    )
}
