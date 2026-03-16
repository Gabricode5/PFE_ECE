from langchain_community.document_loaders import WebBaseLoader
from langchain_text_splitters import HTMLHeaderTextSplitter, RecursiveCharacterTextSplitter
from langchain_ollama import OllamaEmbeddings
from langchain_postgres import PGVector
from dotenv import load_dotenv
import os
import requests
import xml.etree.ElementTree as ET
from urllib.parse import urlparse, urljoin

# On charge les variables du .env avant d'importer la base
load_dotenv()
if not os.environ.get("USER_AGENT"):
    os.environ["USER_AGENT"] = "CRM-KnowledgeBot/1.0"

# 1. Configuration
DEFAULT_URL = "https://www.service-public.fr/particuliers/vosdroits/F1342"
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
EMBED_MODEL = os.getenv("EMBED_MODEL", "nomic-embed-text")
DEFAULT_CATEGORY = os.getenv("KB_CATEGORY", "site_web")
MAX_SITEMAP_URLS = int(os.getenv("MAX_SITEMAP_URLS", "50"))
REQUEST_TIMEOUT = int(os.getenv("SCRAPE_TIMEOUT", "10"))
COLLECTION_NAME = "rag_documents"

def _get_connection_string() -> str:
    raw = os.getenv("DATABASE_URL", "postgresql://admin:Password1234@localhost:5432/ticketdb")
    # langchain-postgres requires psycopg3 driver prefix
    return raw.replace("postgresql://", "postgresql+psycopg://", 1)

# User-Agent simple pour éviter certains blocages côté sites
DEFAULT_HEADERS = {"User-Agent": "Mozilla/5.0"}


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


_HTML_HEADERS = [("h1", "H1"), ("h2", "H2"), ("h3", "H3"), ("h4", "H4")]
_html_splitter = HTMLHeaderTextSplitter(headers_to_split_on=_HTML_HEADERS)
# Fallback splitter: only kicks in when a section exceeds max_chunk chars
_fallback_splitter = RecursiveCharacterTextSplitter(
    separators=["\n\n\n", "\n\n", "\n", ". "],
    chunk_size=2000,
    chunk_overlap=0,
)


def _load_documents_from_urls(urls: list[str]) -> list:
    docs = []
    for page_url in urls:
        try:
            # Fetch raw HTML so HTMLHeaderTextSplitter can read the heading structure
            resp = requests.get(page_url, headers=DEFAULT_HEADERS, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
            html = resp.text
            sections = _html_splitter.split_text(html)
            for sec in sections:
                sec.metadata.setdefault("source", page_url)
            # If a section is still huge, break it further — but keep heading metadata
            docs.extend(_fallback_splitter.split_documents(sections))
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

    # chunks are already produced by _load_documents_from_urls (section-based)
    chunks = docs
    print(f"✂️ {len(chunks)} sections créées.")

    # Tag source metadata on every chunk
    for chunk in chunks:
        chunk.metadata["source"] = source_url
        chunk.metadata["category"] = category_value

    # 7. Embed & persist via langchain-postgres PGVector
    print("Connexion à Postgres et insertion via PGVector...")
    embed = OllamaEmbeddings(model=EMBED_MODEL, base_url=OLLAMA_URL)
    PGVector.from_documents(
        documents=chunks,
        embedding=embed,
        collection_name=COLLECTION_NAME,
        connection=_get_connection_string(),
        use_jsonb=True,
    )
    print(f"✅ Mission accomplie ! {len(chunks)} chunks insérés.")
    return {
        "inserted": len(chunks),
        "chunks": len(chunks),
        "url": source_url,
        "category": category_value,
        "urls_scraped": len(urls_to_scrape),
    }

if __name__ == "__main__":
    ingest_to_postgres()
