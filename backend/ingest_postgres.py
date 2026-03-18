from langchain_community.document_loaders import WebBaseLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from dotenv import load_dotenv
import os
import re
import requests
import xml.etree.ElementTree as ET
from urllib.parse import urlparse, urljoin

from mistral_client import embed_texts

# On charge les variables du .env avant d'importer la base
load_dotenv()
from database import SessionLocal
import models

# 1. Configuration
DEFAULT_URL = "https://www.service-public.fr/particuliers/vosdroits/F1342"
EMBED_MODEL = os.getenv("EMBED_MODEL", "mistral-embed")
DEFAULT_CATEGORY = os.getenv("KB_CATEGORY", "site_web")
MAX_SITEMAP_URLS = int(os.getenv("MAX_SITEMAP_URLS", "50"))
REQUEST_TIMEOUT = int(os.getenv("SCRAPE_TIMEOUT", "10"))
EMBED_BATCH_SIZE = int(os.getenv("EMBED_BATCH_SIZE", "12"))
MAX_KB_CHUNKS = int(os.getenv("MAX_KB_CHUNKS", "80"))

# User-Agent simple pour éviter certains blocages côté sites
DEFAULT_HEADERS = {"User-Agent": "Mozilla/5.0"}
NON_HTML_EXTENSIONS = (
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".zip", ".rar",
    ".7z", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico", ".bmp",
    ".mp3", ".wav", ".mp4", ".avi", ".mov", ".wmv", ".webm", ".woff", ".woff2",
    ".ttf", ".otf", ".eot", ".css", ".js", ".json", ".xml"
)
MIN_TEXT_LENGTH = int(os.getenv("MIN_TEXT_LENGTH", "80"))
MAX_WEIRD_CHAR_RATIO = float(os.getenv("MAX_WEIRD_CHAR_RATIO", "0.2"))
BINARY_SIGNATURE_PATTERNS = (
    "Exif",
    "xmp.did",
    "Adobe",
    "Photoshop",
    "JFIF",
    "ICC_PROFILE",
)


def _sanitize_text(value: str) -> str:
    sanitized = value.replace("\x00", "")
    sanitized = re.sub(r"[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]", " ", sanitized)
    sanitized = re.sub(r"\s+", " ", sanitized)
    return sanitized.strip()


def _looks_like_binary_text(value: str) -> bool:
    if not value:
        return True

    weird_chars = sum(1 for char in value if ord(char) == 65533 or (not char.isprintable() and not char.isspace()))
    if weird_chars / max(len(value), 1) > MAX_WEIRD_CHAR_RATIO:
        return True

    replacement_ratio = value.count("�") / max(len(value), 1)
    if replacement_ratio > 0.02:
        return True

    lowered = value.lower()
    if any(signature.lower() in lowered for signature in BINARY_SIGNATURE_PATTERNS):
        return True

    long_token_match = re.search(r"[A-Za-z0-9+/=]{120,}", value)
    if long_token_match:
        return True

    return False


def _is_allowed_url(page_url: str) -> bool:
    lowered_path = urlparse(page_url).path.lower()
    return not lowered_path.endswith(NON_HTML_EXTENSIONS)


def _extract_loc_urls_from_xml(xml_text: str) -> list[str]:
    # Cette fonction lit un XML de type sitemap et récupère toutes les balises <loc>
    urls: list[str] = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return urls

    # On parcourt toutes les balises et on garde celles qui finissent par "loc"
    for element in root.iter():
        if element.tag.lower().endswith("loc") and element.text:
            value = element.text.strip()
            if value:
                urls.append(value)
    return urls


def _same_domain(base_url: str, candidate_url: str) -> bool:
    # Option de sécurité: on scrape seulement le même domaine
    base_domain = urlparse(base_url).netloc.lower()
    candidate_domain = urlparse(candidate_url).netloc.lower()
    return base_domain == candidate_domain


def _find_sitemap_url(base_url: str) -> str | None:
    # 1) On essaie le chemin standard /sitemap.xml
    sitemap_default = urljoin(base_url, "/sitemap.xml")
    try:
        response = requests.get(sitemap_default, headers=DEFAULT_HEADERS, timeout=REQUEST_TIMEOUT)
        if response.ok and ("xml" in response.headers.get("Content-Type", "").lower() or response.text.strip().startswith("<")):
            return sitemap_default
    except Exception:
        pass

    # 2) Sinon on lit robots.txt pour chercher une ligne "Sitemap:"
    robots_url = urljoin(base_url, "/robots.txt")
    try:
        response = requests.get(robots_url, headers=DEFAULT_HEADERS, timeout=REQUEST_TIMEOUT)
        if not response.ok:
            return None
        for line in response.text.splitlines():
            if line.lower().startswith("sitemap:"):
                sitemap_from_robots = line.split(":", 1)[1].strip()
                if sitemap_from_robots:
                    return sitemap_from_robots
    except Exception:
        return None
    return None


def _collect_urls_from_sitemap(base_url: str) -> list[str]:
    # Cette fonction essaye de récupérer une liste d'URLs via sitemap.xml
    sitemap_url = _find_sitemap_url(base_url)
    if not sitemap_url:
        print("Aucun sitemap trouvé, fallback sur la page unique.")
        return []

    print(f"Sitemap trouvé: {sitemap_url}")
    try:
        response = requests.get(sitemap_url, headers=DEFAULT_HEADERS, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        first_level_urls = _extract_loc_urls_from_xml(response.text)
    except Exception:
        print("Impossible de lire le sitemap, fallback sur la page unique.")
        return []

    # Si le sitemap est vide, on retourne vide et on fera le fallback
    if not first_level_urls:
        print("Sitemap vide, fallback sur la page unique.")
        return []

    # On supporte un cas simple:
    # - soit c'est un urlset (liens de pages)
    # - soit c'est un sitemap index (liens vers d'autres sitemaps)
    page_urls: list[str] = []
    for candidate in first_level_urls:
        if len(page_urls) >= MAX_SITEMAP_URLS:
            break

        # Si ça ressemble à un sous-sitemap, on lit une couche de plus
        if candidate.endswith(".xml"):
            try:
                sub_response = requests.get(candidate, headers=DEFAULT_HEADERS, timeout=REQUEST_TIMEOUT)
                if sub_response.ok:
                    sub_urls = _extract_loc_urls_from_xml(sub_response.text)
                    for sub in sub_urls:
                        if len(page_urls) >= MAX_SITEMAP_URLS:
                            break
                        if _same_domain(base_url, sub):
                            page_urls.append(sub)
            except Exception:
                continue
        else:
            if _same_domain(base_url, candidate):
                page_urls.append(candidate)

    # On retire les doublons en gardant l'ordre
    unique_urls = list(dict.fromkeys(page_urls))
    return unique_urls[:MAX_SITEMAP_URLS]


def _load_documents_from_urls(urls: list[str]) -> list:
    # Cette fonction charge les pages web pour LangChain
    docs = []
    for page_url in urls:
        if not _is_allowed_url(page_url):
            print(f"Page ignorée (extension non textuelle): {page_url}")
            continue
        try:
            loader = WebBaseLoader(page_url)
            loader.requests_kwargs = {"headers": DEFAULT_HEADERS, "timeout": REQUEST_TIMEOUT}
            loaded_docs = loader.load()
            for doc in loaded_docs:
                content = _sanitize_text(doc.page_content or "")
                if len(content) < MIN_TEXT_LENGTH:
                    continue
                if _looks_like_binary_text(content):
                    print(f"Contenu ignoré (binaire ou corrompu): {page_url}")
                    continue
                doc.page_content = content
                docs.append(doc)
        except Exception as e:
            print(f"Page ignorée (erreur): {page_url} -> {e}")
    return docs

def ingest_to_postgres(url: str | None = None, category: str | None = None):
    # 2. Préparer l'URL et la catégorie
    source_url = url or DEFAULT_URL
    category_value = (category or DEFAULT_CATEGORY).strip() or DEFAULT_CATEGORY
    print(f"Début de l'ingestion vers PostgreSQL depuis : {source_url}")

    # 3. Essayer le sitemap XML, sinon fallback sur l'URL de base
    urls_to_scrape = _collect_urls_from_sitemap(source_url)
    if not urls_to_scrape:
        urls_to_scrape = [source_url]
    print(f"Nombre d'URLs à scraper: {len(urls_to_scrape)}")

    # 4. Charger les pages trouvées
    docs = _load_documents_from_urls(urls_to_scrape)
    if not docs:
        raise ValueError("Aucun contenu récupéré. Vérifie l'URL ou les permissions du site.")
    print(f"Pages chargées avec succès: {len(docs)} document(s).")

    # 5. Découpage du texte (Chunking)
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
    chunks = text_splitter.split_documents(docs)
    for chunk in chunks:
        chunk.page_content = _sanitize_text(chunk.page_content)
    chunks = [
        chunk
        for chunk in chunks
        if chunk.page_content
        and len(chunk.page_content) >= MIN_TEXT_LENGTH
        and not _looks_like_binary_text(chunk.page_content)
    ]
    original_chunk_count = len(chunks)
    if MAX_KB_CHUNKS > 0:
        chunks = chunks[:MAX_KB_CHUNKS]
    print(f"✂️ {len(chunks)} morceaux créés.")

    # 6. Insertion directe dans la table SQL custom knowledge_base
    print("Connexion à Postgres et insertion dans knowledge_base...")
    db = SessionLocal()
    inserted = 0
    try:
        chunk_texts = [chunk.page_content for chunk in chunks]
        for start in range(0, len(chunk_texts), EMBED_BATCH_SIZE):
            batch_texts = chunk_texts[start:start + EMBED_BATCH_SIZE]
            batch_vectors = embed_texts(batch_texts, model=EMBED_MODEL, timeout=REQUEST_TIMEOUT)
            for text, vector in zip(batch_texts, batch_vectors, strict=True):
                row = models.KnowledgeBase(
                    source_message_id=None,
                    contenu=text,
                    embedding=vector,
                    category=category_value,
                )
                db.add(row)
                inserted += 1

        db.commit()
        print(f"✅ Mission accomplie ! {inserted} lignes insérées dans 'knowledge_base'.")
        return {
            "inserted": inserted,
            "chunks": len(chunks),
            "url": source_url,
            "category": category_value,
            "urls_scraped": len(urls_to_scrape),
            "truncated": MAX_KB_CHUNKS > 0 and original_chunk_count > MAX_KB_CHUNKS,
        }
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    ingest_to_postgres()
