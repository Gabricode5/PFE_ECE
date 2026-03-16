export const logout = async () => {
    // Supprime le cookie côté serveur (HttpOnly)
    try {
        await fetch("/api/logout", { method: "POST" })
    } catch {
        // continue
    }

    // Nettoie le localStorage
    localStorage.removeItem("username");
    localStorage.removeItem("user_email"); // Assure-toi de les avoir sauvés au login
    localStorage.removeItem("user_full_name");
    localStorage.removeItem("user_role");
    localStorage.removeItem("user_id");

    // Redirection
    window.location.href = "/login";
};
