"use client"

import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"

export function LogoutButton() {
    const router = useRouter()

    const handleLogout = () => {
        // Suppression des cookies
        document.cookie = "auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Strict";
        document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Strict";

        // Nettoyage local
        localStorage.removeItem("username");

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