export const logout = () => {
    // Supprime les cookies
    document.cookie = "auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Strict";
    document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Strict";

    // Nettoie le localStorage
    localStorage.removeItem("username");
    localStorage.removeItem("user_email"); // Assure-toi de les avoir sauvés au login
    localStorage.removeItem("user_full_name");

    // Redirection
    window.location.href = "/login";
};