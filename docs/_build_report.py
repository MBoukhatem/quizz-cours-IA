"""Convert docs/report.md to docs/report.pdf using markdown + weasyprint.

Standalone helper: run once to regenerate the PDF after editing report.md.
Not imported by the app — pure build tooling.
"""
from __future__ import annotations

import re
from pathlib import Path

import markdown
from weasyprint import HTML

HERE = Path(__file__).parent
MD = HERE / "report.md"
PDF = HERE / "report.pdf"

CSS = """
@page {
  size: A4;
  margin: 2.2cm 2cm 2.5cm 2cm;
  @bottom-center {
    content: "quizz-cours-IA — Rapport final — page " counter(page) " / " counter(pages);
    font-size: 9pt;
    color: #666;
  }
}
body {
  font-family: "DejaVu Sans", "Liberation Sans", Helvetica, Arial, sans-serif;
  font-size: 11pt;
  line-height: 1.45;
  color: #1f2328;
}
h1 {
  font-size: 22pt;
  color: #0d1117;
  border-bottom: 2px solid #0d1117;
  padding-bottom: 6px;
  margin-top: 24px;
  page-break-before: always;
}
h1:first-of-type { page-break-before: avoid; }
h2 {
  font-size: 15pt;
  color: #0d1117;
  margin-top: 18px;
  border-bottom: 1px solid #d1d9e0;
  padding-bottom: 4px;
}
h3 { font-size: 12.5pt; color: #0d1117; margin-top: 14px; }
p  { margin: 6px 0; text-align: justify; }
ul, ol { margin: 6px 0 6px 20px; }
li { margin: 2px 0; }
code {
  font-family: "DejaVu Sans Mono", "Liberation Mono", Menlo, monospace;
  background: #f6f8fa;
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 9.5pt;
}
pre {
  background: #f6f8fa;
  padding: 10px;
  border-radius: 4px;
  font-size: 9pt;
  overflow-x: hidden;
  white-space: pre-wrap;
}
pre code { background: transparent; padding: 0; font-size: 9pt; }
table {
  border-collapse: collapse;
  width: 100%;
  margin: 10px 0;
  font-size: 10pt;
}
th, td {
  border: 1px solid #d1d9e0;
  padding: 5px 8px;
  text-align: left;
  vertical-align: top;
}
th { background: #f6f8fa; font-weight: 600; }
a { color: #0969da; text-decoration: none; }
hr { border: none; border-top: 1px solid #d1d9e0; margin: 14px 0; }
blockquote {
  border-left: 3px solid #d1d9e0;
  padding-left: 10px;
  color: #57606a;
  margin: 8px 0;
}
.cover {
  text-align: center;
  margin-top: 4cm;
  page-break-after: always;
}
.cover h1 {
  font-size: 30pt;
  border: none;
  padding: 0;
  margin-bottom: 8px;
  page-break-before: avoid;
}
.cover .subtitle {
  font-size: 16pt;
  color: #57606a;
  margin-bottom: 60px;
}
.cover .meta {
  font-size: 12pt;
  color: #1f2328;
  line-height: 1.8;
}
.toc { page-break-after: always; }
.toc h1 { page-break-before: avoid; }
"""


def strip_yaml_front_matter(text: str) -> tuple[dict, str]:
    """Parse a minimal YAML front matter and return (meta, body)."""
    if not text.startswith("---"):
        return {}, text
    end = text.find("\n---", 3)
    if end == -1:
        return {}, text
    raw = text[3:end].strip()
    body = text[end + 4 :].lstrip()
    meta: dict[str, str] = {}
    for line in raw.splitlines():
        if ":" in line:
            k, _, v = line.partition(":")
            meta[k.strip()] = v.strip().strip('"').strip("'")
    return meta, body


def strip_mermaid_blocks(md_text: str) -> str:
    """Replace ```mermaid ... ``` with a short placeholder line.

    weasyprint does not render mermaid; we keep the diagrams in
    architecture.md (viewed on GitHub / VS Code) and just point to them
    from the PDF.
    """
    pattern = re.compile(r"```mermaid\n.*?\n```", re.DOTALL)
    return pattern.sub(
        "*(diagramme Mermaid — voir `docs/architecture.md` pour le rendu)*",
        md_text,
    )


def build_cover(meta: dict) -> str:
    title = meta.get("title", "Rapport")
    subtitle = meta.get("subtitle", "")
    author = meta.get("author", "")
    date = meta.get("date", "")
    return (
        '<div class="cover">'
        f"<h1>{title}</h1>"
        f'<div class="subtitle">{subtitle}</div>'
        '<div class="meta">'
        f"<div><strong>Auteur :</strong> {author}</div>"
        f"<div><strong>Date :</strong> {date}</div>"
        "</div>"
        "</div>"
    )


def main() -> None:
    raw = MD.read_text(encoding="utf-8")
    meta, body = strip_yaml_front_matter(raw)
    body = strip_mermaid_blocks(body)

    html_body = markdown.markdown(
        body,
        extensions=["extra", "tables", "fenced_code", "toc"],
    )
    cover = build_cover(meta)

    html_doc = (
        "<!doctype html><html><head><meta charset='utf-8'>"
        f"<title>{meta.get('title', 'Rapport')}</title>"
        f"<style>{CSS}</style>"
        "</head><body>"
        + cover
        + html_body
        + "</body></html>"
    )

    HTML(string=html_doc, base_url=str(HERE)).write_pdf(str(PDF))
    print(f"PDF generated: {PDF}")


if __name__ == "__main__":
    main()
